import Big from 'big.js';
import { secondsInYear } from 'date-fns';
import { ContractCallContext, ContractCallResults, Multicall } from 'ethereum-multicall';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { Address, Chain } from 'wagmi';

import KittyLensABI from '../assets/abis/KittyLens.json';
import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import VolatilityOracleABI from '../assets/abis/VolatilityOracle.json';
import { makeEtherscanRequest } from '../util/Etherscan';
import { convertBigNumbersForReturnContexts } from '../util/Multicall';
import { toBig } from '../util/Numbers';
import {
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_ORACLE,
  ALOE_II_KITTY_LENS_ADDRESS,
} from './constants/Addresses';
import { TOPIC0_CREATE_BORROWER_EVENT } from './constants/Signatures';
import { BIGQ96 } from './constants/Values';
import { Token } from './Token';
import { getToken } from './TokenData';

export type UniswapPosition = {
  lower: number;
  upper: number;
  liquidity: JSBI;
};

export type UniswapPositionPrior = Omit<UniswapPosition, 'amount0' | 'amount1' | 'liquidity'>;

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
  address: string;
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

export type MarketInfo = {
  lender0: Address;
  lender1: Address;
  borrowerAPR0: number;
  borrowerAPR1: number;
  lender0Utilization: number;
  lender1Utilization: number;
  lender0TotalSupply: Big;
  lender1TotalSupply: Big;
  lender0TotalBorrows: Big;
  lender1TotalBorrows: Big;
};

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
  chain: Chain,
  userAddress: string,
  provider: ethers.providers.Provider
): Promise<{ address: string; uniswapPool: string }[]> {
  const etherscanResult = await makeEtherscanRequest(
    0,
    ALOE_II_FACTORY_ADDRESS,
    [TOPIC0_CREATE_BORROWER_EVENT, null, `0x000000000000000000000000${userAddress.slice(2)}`],
    true,
    chain
  );
  if (!Array.isArray(etherscanResult.data.result)) return [];

  const accounts: { address: string; uniswapPool: string }[] = etherscanResult.data.result.map((item: any) => {
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

export async function fetchMarginAccountPreviews(
  chain: Chain,
  provider: ethers.providers.BaseProvider,
  userAddress: string,
  uniswapPoolDataMap: Map<string, UniswapPoolInfo>
): Promise<MarginAccountPreview[]> {
  const multicall = new Multicall({ ethersProvider: provider, tryAggregate: true });
  const marginAccountsAddresses = await getMarginAccountsForUser(chain, userAddress, provider);
  let contractCallContext: ContractCallContext[] = [];

  marginAccountsAddresses.forEach(({ address: accountAddress, uniswapPool }) => {
    const uniswapPoolInfo = uniswapPoolDataMap.get(`0x${uniswapPool}`) ?? null;

    if (uniswapPoolInfo === null) return;

    const token0 = uniswapPoolInfo.token0;
    const token1 = uniswapPoolInfo.token1;
    const feeTier = NumericFeeTierToEnum(uniswapPoolInfo.fee);

    if (!token0 || !token1) return;

    contractCallContext.push({
      reference: accountAddress,
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
        feeTier: feeTier,
        token0: token0,
        token1: token1,
        accountAddress: accountAddress,
        uniswapPool: uniswapPool,
      },
    });
  });

  const results = (await multicall.call(contractCallContext)).results;

  let marginAccounts: MarginAccountPreview[] = [];

  Object.values(results).forEach((value) => {
    const contractResults = value.callsReturnContext;
    const updatedReturnContext = convertBigNumbersForReturnContexts(contractResults);
    const { feeTier, token0, token1, accountAddress, uniswapPool } = value.originalContractCallContext.context;
    const assetsData = updatedReturnContext[0].returnValues;
    const liabilitiesData = updatedReturnContext[1].returnValues;
    const healthData = updatedReturnContext[2].returnValues;
    const healthData0 = Big(healthData[0].toString());
    const healthData1 = Big(healthData[1].toString());
    const health = healthData0.lt(healthData1) ? healthData0 : healthData1;
    const assets: Assets = {
      token0Raw: Big(assetsData[0].toString())
        .div(10 ** token0.decimals)
        .toNumber(),
      token1Raw: Big(assetsData[1].toString())
        .div(10 ** token1.decimals)
        .toNumber(),
      uni0: Big(assetsData[4].toString())
        .div(10 ** token0.decimals)
        .toNumber(),
      uni1: Big(assetsData[5].toString())
        .div(10 ** token1.decimals)
        .toNumber(),
    };
    const liabilities: Liabilities = {
      amount0: Big(liabilitiesData[0].toString())
        .div(10 ** token0.decimals)
        .toNumber(),
      amount1: Big(liabilitiesData[1].toString())
        .div(10 ** token1.decimals)
        .toNumber(),
    };
    marginAccounts.push({
      address: accountAddress,
      uniswapPool,
      token0,
      token1,
      feeTier,
      assets,
      liabilities,
      health: health.div(1e9).toNumber() / 1e9,
    });
  });
  return marginAccounts;
}

export async function fetchMarketInfoFor(
  lenderLensContract: ethers.Contract,
  lender0: Address,
  lender1: Address
): Promise<MarketInfo> {
  const multicall = new Multicall({ ethersProvider: lenderLensContract.provider, tryAggregate: true });
  const contractCallContext: ContractCallContext[] = [
    {
      reference: 'readBasics',
      contractAddress: ALOE_II_KITTY_LENS_ADDRESS,
      abi: KittyLensABI,
      calls: [
        {
          reference: 'lender0',
          methodName: 'readBasics',
          methodParameters: [lender0],
        },
        {
          reference: 'lender1',
          methodName: 'readBasics',
          methodParameters: [lender1],
        },
      ],
    },
  ];

  const results = (await multicall.call(contractCallContext)).results;
  const updatedReturnContext = convertBigNumbersForReturnContexts(results['readBasics'].callsReturnContext);
  const lender0Basics = updatedReturnContext[0].returnValues;
  const lender1Basics = updatedReturnContext[1].returnValues;

  const interestRate0 = new Big(lender0Basics[1].toString());
  const borrowAPR0 = interestRate0.eq('0') ? 0 : interestRate0.sub(1e12).div(1e12).toNumber() * secondsInYear;
  const interestRate1 = new Big(lender1Basics[1].toString());
  const borrowAPR1 = interestRate1.eq('0') ? 0 : interestRate1.sub(1e12).div(1e12).toNumber() * secondsInYear;
  const lender0Utilization = new Big(lender0Basics[2].toString()).div(10 ** 18).toNumber();
  const lender1Utilization = new Big(lender1Basics[2].toString()).div(10 ** 18).toNumber();
  const lender0TotalSupply = new Big(lender0Basics[3].toString());
  const lender1TotalSupply = new Big(lender1Basics[3].toString());
  const lender0TotalBorrows = new Big(lender0Basics[4].toString());
  const lender1TotalBorrows = new Big(lender1Basics[4].toString());
  return {
    lender0,
    lender1,
    borrowerAPR0: borrowAPR0,
    borrowerAPR1: borrowAPR1,
    lender0Utilization: lender0Utilization,
    lender1Utilization: lender1Utilization,
    lender0TotalSupply: lender0TotalSupply,
    lender1TotalSupply: lender1TotalSupply,
    lender0TotalBorrows: lender0TotalBorrows,
    lender1TotalBorrows: lender1TotalBorrows,
  };
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

  const contractCallContext: ContractCallContext[] = [
    {
      reference: 'marginAccountContract',
      contractAddress: marginAccountAddress,
      abi: MarginAccountABI,
      calls: [
        { reference: 'token0', methodName: 'TOKEN0', methodParameters: [] },
        { reference: 'token1', methodName: 'TOKEN1', methodParameters: [] },
        { reference: 'lender0', methodName: 'LENDER0', methodParameters: [] },
        { reference: 'lender1', methodName: 'LENDER1', methodParameters: [] },
        { reference: 'uniswapPool', methodName: 'UNISWAP_POOL', methodParameters: [] },
      ],
    },
    {
      reference: 'marginAccountLensContract',
      contractAddress: ALOE_II_BORROWER_LENS_ADDRESS,
      abi: MarginAccountLensABI,
      calls: [
        { reference: 'assets', methodName: 'getAssets', methodParameters: [marginAccountAddress] },
        { reference: 'liabilities', methodName: 'getLiabilities', methodParameters: [marginAccountAddress, true] },
        { reference: 'health', methodName: 'getHealth', methodParameters: [accountAddress, true] },
      ],
    },
  ];

  const results: ContractCallResults = await multicall.call(contractCallContext);
  const marginAccountContractResults = results.results['marginAccountContract'].callsReturnContext;
  const marginAccountLensContractResults = results.results['marginAccountLensContract'].callsReturnContext;
  const updatedLensReturnContext = convertBigNumbersForReturnContexts(marginAccountLensContractResults);
  const token0 = getToken(chain.id, marginAccountContractResults[0].returnValues[0]);
  const token1 = getToken(chain.id, marginAccountContractResults[1].returnValues[0]);
  const lender0 = marginAccountContractResults[2].returnValues[0];
  const lender1 = marginAccountContractResults[3].returnValues[0];
  const uniswapPool = marginAccountContractResults[4].returnValues[0];
  const assetsData = updatedLensReturnContext[0].returnValues;
  const liabilitiesData = updatedLensReturnContext[1].returnValues;
  const healthData = updatedLensReturnContext[2].returnValues;

  const uniswapPoolContract = new ethers.Contract(uniswapPool, UniswapV3PoolABI, provider);
  const volatilityOracleContract = new ethers.Contract(ALOE_II_ORACLE, VolatilityOracleABI, provider);
  const [feeTier, oracleResult] = await Promise.all([
    uniswapPoolContract.fee(),
    volatilityOracleContract.consult(uniswapPool),
  ]);

  const assets: Assets = {
    token0Raw: Big(assetsData[0].toString())
      .div(10 ** token0.decimals)
      .toNumber(),
    token1Raw: Big(assetsData[1].toString())
      .div(10 ** token1.decimals)
      .toNumber(),
    uni0: Big(assetsData[4].toString())
      .div(10 ** token0.decimals)
      .toNumber(),
    uni1: Big(assetsData[5].toString())
      .div(10 ** token1.decimals)
      .toNumber(),
  };
  const liabilities: Liabilities = {
    amount0: Big(liabilitiesData[0].toString())
      .div(10 ** token0.decimals)
      .toNumber(),
    amount1: Big(liabilitiesData[1].toString())
      .div(10 ** token1.decimals)
      .toNumber(),
  };

  const healthData0 = Big(healthData[0].toString());
  const healthData1 = Big(healthData[1].toString());
  const health = healthData0.lt(healthData1) ? healthData0 : healthData1;

  return {
    marginAccount: {
      address: marginAccountAddress,
      uniswapPool: uniswapPool,
      token0: token0,
      token1: token1,
      feeTier: NumericFeeTierToEnum(feeTier),
      assets: assets,
      liabilities: liabilities,
      sqrtPriceX96: toBig(oracleResult[0]),
      health: health.div(1e9).toNumber() / 1e9,
      lender0: lender0,
      lender1: lender1,
      iv: oracleResult[1].div(1e9).toNumber() / 1e9,
    },
  };
}

export function sqrtRatioToPrice(sqrtPriceX96: Big, token0Decimals: number, token1Decimals: number): number {
  return sqrtPriceX96
    .mul(sqrtPriceX96)
    .div(BIGQ96)
    .div(BIGQ96)
    .mul(10 ** (token0Decimals - token1Decimals))
    .toNumber();
}

export function priceToSqrtRatio(price: number, token0Decimals: number, token1Decimals: number): Big {
  return new Big(price)
    .mul(10 ** (token1Decimals - token0Decimals))
    .sqrt()
    .mul(BIGQ96);
}

export function sumAssetsPerToken(assets: Assets): [number, number] {
  return [assets.token0Raw + assets.uni0, assets.token1Raw + assets.uni1];
}
