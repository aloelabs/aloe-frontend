import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { ethers } from 'ethers';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { GN } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { getToken } from 'shared/lib/data/TokenData';
import { toImpreciseNumber } from 'shared/lib/util/Numbers';
import { Address, Chain } from 'wagmi';

import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import VolatilityOracleABI from '../assets/abis/VolatilityOracle.json';
import { ContractCallReturnContextEntries, convertBigNumbersForReturnContexts } from '../util/Multicall';
import { ALOE_II_BORROWER_LENS_ADDRESS, ALOE_II_FACTORY_ADDRESS, ALOE_II_ORACLE_ADDRESS } from './constants/Addresses';
import { TOPIC0_CREATE_BORROWER_EVENT } from './constants/Signatures';

export type Assets = {
  token0Raw: GN;
  token1Raw: GN;
  uni0: GN;
  uni1: GN;
};

export type Liabilities = {
  amount0: GN;
  amount1: GN;
};

/**
 * For the use-cases that require all of the data
 */
export type MarginAccount = {
  address: string;
  uniswapPool: string;
  token0: Token;
  token1: Token;
  feeTier: FeeTier;
  assets: Assets;
  liabilities: Liabilities;
  sqrtPriceX96: GN;
  health: number;
  lender0: Address;
  lender1: Address;
  iv: GN;
};

export type UniswapPoolInfo = {
  token0: Address;
  token1: Address;
  fee: number;
};

// We do a lot of math to compute these, but once we have them they're only for display. Sometimes
// we want to display them in terms of the other token (take the reciprocal) so it's easier to use
// numbers instead of `GN`
export type LiquidationThresholds = {
  lower: number;
  upper: number;
};

/**
 * For the use-cases that may not require all of the data
 * (When we don't want to fetch more than we need)
 */
export type MarginAccountPreview = Omit<MarginAccount, 'sqrtPriceX96' | 'lender0' | 'lender1' | 'iv'>;

export async function getMarginAccountsForUser(
  userAddress: string,
  provider: ethers.providers.Provider
): Promise<{ address: string; uniswapPool: string }[]> {
  let logs: ethers.providers.Log[] = [];
  try {
    logs = await provider.getLogs({
      fromBlock: 0,
      toBlock: 'latest',
      address: ALOE_II_FACTORY_ADDRESS,
      topics: [TOPIC0_CREATE_BORROWER_EVENT, null, `0x000000000000000000000000${userAddress.slice(2)}`],
    });
  } catch (e) {
    console.error(e);
  }
  if (logs.length === 0) return [];

  const accounts: { address: string; uniswapPool: string }[] = logs.map((item: any) => {
    return {
      address: item.data.slice(0, 2) + item.data.slice(26),
      uniswapPool: item.topics[1].slice(26),
    };
  });

  return accounts;
}

export async function fetchMarginAccountPreviews(
  chain: Chain,
  provider: ethers.providers.BaseProvider,
  userAddress: string,
  uniswapPoolDataMap: Map<string, UniswapPoolInfo>
): Promise<MarginAccountPreview[]> {
  const multicall = new Multicall({ ethersProvider: provider, tryAggregate: true });
  const marginAccountsAddresses = await getMarginAccountsForUser(userAddress, provider);
  const marginAccountCallContext: ContractCallContext[] = [];

  // Fetch all the data for the margin accounts
  marginAccountsAddresses.forEach(({ address: accountAddress, uniswapPool }) => {
    const uniswapPoolInfo = uniswapPoolDataMap.get(`0x${uniswapPool}`) ?? null;

    if (uniswapPoolInfo === null) return;

    const token0 = uniswapPoolInfo.token0;
    const token1 = uniswapPoolInfo.token1;
    const fee = uniswapPoolInfo.fee;

    if (!token0 || !token1) return;
    // Fetching the data for the margin account using three contracts
    marginAccountCallContext.push({
      reference: `${accountAddress}-lens`,
      contractAddress: ALOE_II_BORROWER_LENS_ADDRESS,
      abi: MarginAccountLensABI,
      calls: [
        {
          reference: 'getAssets',
          methodName: 'getAssets',
          methodParameters: [accountAddress],
        },
        {
          reference: 'getLiabilities',
          methodName: 'getLiabilities',
          methodParameters: [accountAddress, true],
        },
        {
          reference: 'getHealth',
          methodName: 'getHealth',
          methodParameters: [accountAddress, true],
        },
      ],
      context: {
        fee: fee,
        token0Address: token0,
        token1Address: token1,
        chainId: chain.id,
        accountAddress: accountAddress,
        uniswapPool: uniswapPool,
      },
    });
  });

  const marginAccountResults = (await multicall.call(marginAccountCallContext)).results;

  const correspondingMarginAccountResults: Map<string, ContractCallReturnContextEntries> = new Map();

  // Convert the results into a map of account address to the results
  Object.entries(marginAccountResults).forEach(([key, value]) => {
    const entryAccountAddress = key.split('-')[0];
    const entryType = key.split('-')[1];
    const existingValue = correspondingMarginAccountResults.get(entryAccountAddress);
    if (existingValue) {
      existingValue[entryType] = value;
      correspondingMarginAccountResults.set(entryAccountAddress, existingValue);
    } else {
      correspondingMarginAccountResults.set(entryAccountAddress, { [entryType]: value });
    }
  });

  const marginAccountPreviews: MarginAccountPreview[] = [];

  correspondingMarginAccountResults.forEach((value) => {
    const { lens: lensResults } = value;
    const lensReturnContexts = convertBigNumbersForReturnContexts(lensResults.callsReturnContext);
    const { fee, token0Address, token1Address, chainId, accountAddress, uniswapPool } =
      lensResults.originalContractCallContext.context;
    // Reconstruct the objects (since we can't transfer them as is through the context)
    const feeTier = NumericFeeTierToEnum(fee);
    const token0 = getToken(chainId, token0Address);
    const token1 = getToken(chainId, token1Address);
    const assetsData = lensReturnContexts[0].returnValues;
    const liabilitiesData = lensReturnContexts[1].returnValues;
    const healthData = lensReturnContexts[2].returnValues;

    const health = toImpreciseNumber(healthData[0].lt(healthData[1]) ? healthData[0] : healthData[1], 18);
    const assets: Assets = {
      token0Raw: GN.fromBigNumber(assetsData[0], token0.decimals),
      token1Raw: GN.fromBigNumber(assetsData[1], token1.decimals),
      uni0: GN.fromBigNumber(assetsData[4], token0.decimals),
      uni1: GN.fromBigNumber(assetsData[5], token1.decimals),
    };
    const liabilities: Liabilities = {
      amount0: GN.fromBigNumber(liabilitiesData[0], token0.decimals),
      amount1: GN.fromBigNumber(liabilitiesData[1], token1.decimals),
    };
    const marginAccountPreview: MarginAccountPreview = {
      address: accountAddress,
      uniswapPool,
      token0,
      token1,
      feeTier,
      assets,
      liabilities,
      health: health,
    };
    marginAccountPreviews.push(marginAccountPreview);
  });

  return marginAccountPreviews;
}

export async function fetchMarginAccount(
  accountAddress: string,
  chain: Chain,
  provider: ethers.providers.BaseProvider,
  marginAccountAddress: string
): Promise<{
  marginAccount: MarginAccount;
}> {
  const multicall = new Multicall({ ethersProvider: provider, tryAggregate: true });
  const marginAccountCallContext: ContractCallContext[] = [];
  marginAccountCallContext.push({
    abi: MarginAccountABI,
    contractAddress: marginAccountAddress,
    reference: 'marginAccountReturnContext',
    calls: [
      {
        reference: 'token0',
        methodName: 'TOKEN0',
        methodParameters: [],
      },
      {
        reference: 'token1',
        methodName: 'TOKEN1',
        methodParameters: [],
      },
      {
        reference: 'lender0',
        methodName: 'LENDER0',
        methodParameters: [],
      },
      {
        reference: 'lender1',
        methodName: 'LENDER1',
        methodParameters: [],
      },
      {
        reference: 'uniswapPool',
        methodName: 'UNISWAP_POOL',
        methodParameters: [],
      },
    ],
  });
  marginAccountCallContext.push({
    abi: MarginAccountLensABI,
    contractAddress: ALOE_II_BORROWER_LENS_ADDRESS,
    reference: 'marginAccountLensReturnContext',
    calls: [
      {
        reference: 'getAssets',
        methodName: 'getAssets',
        methodParameters: [marginAccountAddress],
      },
      {
        reference: 'getLiabilities',
        methodName: 'getLiabilities',
        methodParameters: [marginAccountAddress, true],
      },
      {
        reference: 'getHealth',
        methodName: 'getHealth',
        methodParameters: [accountAddress, true],
      },
    ],
  });
  const results = (await multicall.call(marginAccountCallContext)).results;
  const { marginAccountReturnContext, marginAccountLensReturnContext } = results;
  const marginAccountResults = marginAccountReturnContext.callsReturnContext;
  const marginAccountLensResults = convertBigNumbersForReturnContexts(
    marginAccountLensReturnContext.callsReturnContext
  );

  const token0Address = marginAccountResults[0].returnValues[0] as Address;
  const token1Address = marginAccountResults[1].returnValues[0] as Address;

  const uniswapPool = marginAccountResults[4].returnValues[0] as Address;
  const uniswapPoolContract = new ethers.Contract(uniswapPool, UniswapV3PoolABI, provider);
  const volatilityOracleContract = new ethers.Contract(ALOE_II_ORACLE_ADDRESS, VolatilityOracleABI, provider);
  const token0 = getToken(chain.id, token0Address);
  const token1 = getToken(chain.id, token1Address);
  const lender0 = marginAccountResults[2].returnValues[0] as Address;
  const lender1 = marginAccountResults[3].returnValues[0] as Address;
  const assetsData = marginAccountLensResults[0].returnValues;
  const liabilitiesData = marginAccountLensResults[1].returnValues;
  const [feeTier, oracleResult] = await Promise.all([
    uniswapPoolContract.fee(),
    volatilityOracleContract.consult(uniswapPool),
  ]);

  const assets: Assets = {
    token0Raw: GN.fromBigNumber(assetsData[0], token0.decimals), // fixed0
    token1Raw: GN.fromBigNumber(assetsData[1], token1.decimals), // fixed1
    uni0: GN.fromBigNumber(assetsData[4], token0.decimals), // fluid0C
    uni1: GN.fromBigNumber(assetsData[5], token1.decimals), // fluid1C
  };
  const liabilities: Liabilities = {
    amount0: GN.fromBigNumber(liabilitiesData[0], token0.decimals),
    amount1: GN.fromBigNumber(liabilitiesData[1], token1.decimals),
  };

  const healthData = marginAccountLensResults[2].returnValues;
  const health = toImpreciseNumber(healthData[0].lt(healthData[1]) ? healthData[0] : healthData[1], 18);
  const iv = GN.fromBigNumber(oracleResult[1], 18);

  return {
    marginAccount: {
      address: marginAccountAddress,
      feeTier: NumericFeeTierToEnum(feeTier),
      sqrtPriceX96: GN.fromBigNumber(oracleResult[0], 96, 2),
      uniswapPool,
      token0,
      token1,
      assets,
      liabilities,
      health,
      lender0,
      lender1,
      iv,
    },
  };
}
