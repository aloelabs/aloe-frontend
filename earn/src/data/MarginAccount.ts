import Big from 'big.js';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { ethers } from 'ethers';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { Token } from 'shared/lib/data/Token';
import { toBig, toImpreciseNumber } from 'shared/lib/util/Numbers';
import { Address, Chain } from 'wagmi';

import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import VolatilityOracleABI from '../assets/abis/VolatilityOracle.json';
import { ContractCallReturnContextEntries, convertBigNumbersForReturnContexts } from '../util/Multicall';
import { ALOE_II_BORROWER_LENS_ADDRESS, ALOE_II_FACTORY_ADDRESS, ALOE_II_ORACLE_ADDRESS } from './constants/Addresses';
import { TOPIC0_CREATE_BORROWER_EVENT } from './constants/Signatures';
import { getToken } from './TokenData';

export type Assets = {
  token0Raw: number;
  token1Raw: number;
  uni0: number;
  uni1: number;
};

export type Liabilities = {
  amount0: number;
  amount1: number;
};

/**
 * For the use-cases that require all of the data
 */
export type MarginAccount = {
  address: Address;
  uniswapPool: string;
  token0: Token;
  token1: Token;
  feeTier: FeeTier;
  assets: Assets;
  liabilities: Liabilities;
  sqrtPriceX96: Big;
  health: number;
  lender0: Address;
  lender1: Address;
  iv: number;
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
  if (logs == null || !Array.isArray(logs)) return [];

  const accounts: { address: string; uniswapPool: string }[] = logs.map((item: any) => {
    return {
      address: item.data.slice(0, 2) + item.data.slice(26),
      uniswapPool: item.topics[1].slice(26),
    };
  });

  return accounts;
}

export type UniswapPoolInfo = {
  token0: Token;
  token1: Token;
  fee: number;
};

export async function fetchMarginAccounts(
  chain: Chain,
  provider: ethers.providers.BaseProvider,
  userAddress: string,
  uniswapPoolDataMap: Map<string, UniswapPoolInfo>
): Promise<MarginAccount[]> {
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
      reference: `${accountAddress}-account`,
      contractAddress: accountAddress,
      abi: MarginAccountABI,
      calls: [
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
      ],
    });
    marginAccountCallContext.push({
      reference: `${accountAddress}-oracle`,
      contractAddress: ALOE_II_ORACLE_ADDRESS,
      abi: VolatilityOracleABI,
      calls: [
        {
          reference: 'consult',
          methodName: 'consult',
          methodParameters: [uniswapPool],
        },
      ],
    });
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
        token0Address: token0.address,
        token1Address: token1.address,
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

  const marginAccounts: MarginAccount[] = [];

  correspondingMarginAccountResults.forEach((value) => {
    const { lens: lensResults, account: accountResults, oracle: oracleResults } = value;
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
      token0Raw: toImpreciseNumber(assetsData[0], token0.decimals),
      token1Raw: toImpreciseNumber(assetsData[1], token1.decimals),
      uni0: toImpreciseNumber(assetsData[4], token0.decimals),
      uni1: toImpreciseNumber(assetsData[5], token1.decimals),
    };
    const liabilities: Liabilities = {
      amount0: toImpreciseNumber(liabilitiesData[0], token0.decimals),
      amount1: toImpreciseNumber(liabilitiesData[1], token1.decimals),
    };

    const lender0 = accountResults.callsReturnContext[0].returnValues[0];
    const lender1 = accountResults.callsReturnContext[1].returnValues[0];
    const oracleReturnValues = convertBigNumbersForReturnContexts(oracleResults.callsReturnContext)[0].returnValues;
    const marginAccount: MarginAccount = {
      address: accountAddress,
      sqrtPriceX96: toBig(oracleReturnValues[0]),
      iv: toImpreciseNumber(oracleReturnValues[1], 18),
      uniswapPool,
      feeTier,
      assets,
      liabilities,
      health,
      token0,
      token1,
      lender0,
      lender1,
    };
    marginAccounts.push(marginAccount);
  });

  return marginAccounts;
}
