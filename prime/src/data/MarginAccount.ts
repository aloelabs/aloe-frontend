import { TickMath } from '@uniswap/v3-sdk';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerLensAbi } from 'shared/lib/abis/BorrowerLens';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { uniswapV3PoolAbi } from 'shared/lib/abis/UniswapV3Pool';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import {
  ALOE_II_ORACLE_ADDRESS,
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_FACTORY_ADDRESS,
  MULTICALL_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { Q32 } from 'shared/lib/data/constants/Values';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { GN } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { getToken } from 'shared/lib/data/TokenData';
import { toImpreciseNumber } from 'shared/lib/util/Numbers';
import { Address, Chain, erc20ABI } from 'wagmi';

import { UniswapPosition, UniswapPositionPrior } from './actions/Actions';
import { TOPIC0_CREATE_BORROWER_EVENT } from './constants/Signatures';
import { ContractCallReturnContextEntries, convertBigNumbersForReturnContexts } from '../util/Multicall';
import { getAmountsForLiquidity, uniswapPositionKey } from '../util/Uniswap';

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
  nSigma: number;
  // TODO: now that we're fetching uniswap positions earlier, we could make them part of the MarginAccount type
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
export type MarginAccountPreview = Omit<
  MarginAccount,
  'assets' | 'sqrtPriceX96' | 'lender0' | 'lender1' | 'iv' | 'nSigma'
>;

export async function getMarginAccountsForUser(
  userAddress: string,
  provider: ethers.providers.Provider,
  chain: Chain
): Promise<{ address: string; uniswapPool: string }[]> {
  let logs: ethers.providers.Log[] = [];
  try {
    logs = await provider.getLogs({
      fromBlock: 0,
      toBlock: 'latest',
      address: ALOE_II_FACTORY_ADDRESS[chain.id],
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
  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chain.id],
  });
  const marginAccountsAddresses = await getMarginAccountsForUser(userAddress, provider, chain);
  const marginAccountCallContext: ContractCallContext[] = [];

  // Fetch all the data for the Borrowers
  marginAccountsAddresses.forEach(({ address: accountAddress, uniswapPool }) => {
    const uniswapPoolInfo = uniswapPoolDataMap.get(`0x${uniswapPool}`) ?? null;

    if (uniswapPoolInfo === null) return;

    const token0 = uniswapPoolInfo.token0;
    const token1 = uniswapPoolInfo.token1;
    const fee = uniswapPoolInfo.fee;

    if (!token0 || !token1) return;
    // Fetching the data for the Borrower using three contracts
    marginAccountCallContext.push(
      {
        reference: `${accountAddress}-account`,
        contractAddress: accountAddress,
        abi: borrowerAbi as any,
        calls: [{ reference: 'getLiabilities', methodName: 'getLiabilities', methodParameters: [] }],
      },
      {
        reference: `${accountAddress}-lens`,
        contractAddress: ALOE_II_BORROWER_LENS_ADDRESS[chain.id],
        abi: borrowerLensAbi as any,
        calls: [{ reference: 'getHealth', methodName: 'getHealth', methodParameters: [accountAddress] }],
        context: {
          fee: fee,
          token0Address: token0,
          token1Address: token1,
          chainId: chain.id,
          accountAddress: accountAddress,
          uniswapPool: uniswapPool,
        },
      }
    );
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
    const { lens: lensResults, account: accountResults } = value;
    const accountReturnContexts = convertBigNumbersForReturnContexts(accountResults.callsReturnContext);
    const lensReturnContexts = convertBigNumbersForReturnContexts(lensResults.callsReturnContext);
    const { fee, token0Address, token1Address, chainId, accountAddress, uniswapPool } =
      lensResults.originalContractCallContext.context;
    // Reconstruct the objects (since we can't transfer them as is through the context)
    const feeTier = NumericFeeTierToEnum(fee);
    const token0 = getToken(chainId, token0Address)!;
    const token1 = getToken(chainId, token1Address)!;
    const liabilitiesData = accountReturnContexts[0].returnValues;
    const healthData = lensReturnContexts[0].returnValues;

    const health = toImpreciseNumber(healthData[0].lt(healthData[1]) ? healthData[0] : healthData[1], 18);
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
  borrowerAddress: string
) {
  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chain.id],
  });

  // MARK: multicall for Borrower and BorrowerLens
  const borrowerCallContext: ContractCallContext[] = [];
  borrowerCallContext.push({
    abi: borrowerAbi as any,
    contractAddress: borrowerAddress,
    reference: 'borrowerReturnContext',
    calls: [
      { reference: 'token0', methodName: 'TOKEN0', methodParameters: [] },
      { reference: 'token1', methodName: 'TOKEN1', methodParameters: [] },
      { reference: 'lender0', methodName: 'LENDER0', methodParameters: [] },
      { reference: 'lender1', methodName: 'LENDER1', methodParameters: [] },
      { reference: 'uniswapPool', methodName: 'UNISWAP_POOL', methodParameters: [] },
      { reference: 'uniswapPositionTicks', methodName: 'getUniswapPositions', methodParameters: [] },
      { reference: 'liabilities', methodName: 'getLiabilities', methodParameters: [] },
    ],
  });
  borrowerCallContext.push({
    abi: borrowerLensAbi as any,
    contractAddress: ALOE_II_BORROWER_LENS_ADDRESS[chain.id],
    reference: 'borrowerLensReturnContext',
    calls: [{ reference: 'getHealth', methodName: 'getHealth', methodParameters: [accountAddress] }],
  });
  const { borrowerReturnContext, borrowerLensReturnContext } = (await multicall.call(borrowerCallContext)).results;
  const borrowerResults = borrowerReturnContext.callsReturnContext;
  const borrowerLensResults = borrowerLensReturnContext.callsReturnContext;

  // MARK: parsing return values from first multicall
  // --> Borrower
  const token0 = getToken(chain.id, borrowerResults[0].returnValues[0] as Address)!;
  const token1 = getToken(chain.id, borrowerResults[1].returnValues[0] as Address)!;
  const lender0 = borrowerResults[2].returnValues[0] as Address;
  const lender1 = borrowerResults[3].returnValues[0] as Address;
  const uniswapPool = borrowerResults[4].returnValues[0] as Address;
  const uniswapPositionTicks = borrowerResults[5].returnValues;
  const uniswapPositionPriors: UniswapPositionPrior[] = [];
  for (let i = 0; i < uniswapPositionTicks.length; i += 2) {
    uniswapPositionPriors.push({
      lower: uniswapPositionTicks[i] as number,
      upper: uniswapPositionTicks[i + 1] as number,
    });
  }
  const uniswapPositionKeys = uniswapPositionPriors.map((prior) =>
    uniswapPositionKey(borrowerAddress, prior.lower!, prior.upper!)
  );
  const liabilities: Liabilities = {
    amount0: GN.fromJSBI(JSBI.BigInt(borrowerResults[6].returnValues[0].hex), token0.decimals),
    amount1: GN.fromJSBI(JSBI.BigInt(borrowerResults[6].returnValues[1].hex), token1.decimals),
  };
  // --> BorrowerLens
  const healthGNs = borrowerLensResults[0].returnValues.map((x) => GN.fromJSBI(JSBI.BigInt(x.hex), 18));
  const health = GN.min(...healthGNs);

  // MARK: multicall for VolatilityOracle, Factory, Uniswap pool, and underlying tokens
  const secondaryCallContext: ContractCallContext[] = [];
  secondaryCallContext.push({
    abi: volatilityOracleAbi as any,
    contractAddress: ALOE_II_ORACLE_ADDRESS[chain.id],
    reference: 'oracleReturnContext',
    calls: [{ reference: 'consult', methodName: 'consult', methodParameters: [uniswapPool, Q32] }],
  });
  secondaryCallContext.push({
    abi: factoryAbi as any,
    contractAddress: ALOE_II_FACTORY_ADDRESS[chain.id],
    reference: 'factoryReturnContext',
    calls: [{ reference: 'parameters', methodName: 'getParameters', methodParameters: [uniswapPool] }],
  });
  secondaryCallContext.push({
    abi: uniswapV3PoolAbi as any,
    contractAddress: uniswapPool,
    reference: 'uniswapReturnContext',
    calls: [{ reference: 'fee', methodName: 'fee', methodParameters: [] }].concat(
      uniswapPositionKeys.map((key) => ({
        reference: `positions-${key}`,
        methodName: 'positions',
        methodParameters: [key] as never[],
      }))
    ),
  });
  secondaryCallContext.push({
    abi: erc20ABI as any,
    contractAddress: token0.address,
    reference: 'token0ReturnContext',
    calls: [{ reference: 'balanceOf', methodName: 'balanceOf', methodParameters: [borrowerAddress] }],
  });
  secondaryCallContext.push({
    abi: erc20ABI as any,
    contractAddress: token1.address,
    reference: 'token1ReturnContext',
    calls: [{ reference: 'balanceOf', methodName: 'balanceOf', methodParameters: [borrowerAddress] }],
  });
  const { oracleReturnContext, factoryReturnContext, uniswapReturnContext, token0ReturnContext, token1ReturnContext } =
    (await multicall.call(secondaryCallContext)).results;
  const oracleResults = oracleReturnContext.callsReturnContext;
  const factoryResults = factoryReturnContext.callsReturnContext;
  const uniswapResults = uniswapReturnContext.callsReturnContext;
  const token0Results = token0ReturnContext.callsReturnContext;
  const token1Results = token1ReturnContext.callsReturnContext;

  // MARK: parsing return values from second multicall
  // --> VolatilityOracle
  const sqrtPriceX96 = GN.fromJSBI(JSBI.BigInt(oracleResults[0].returnValues[1].hex), 96, 2);
  const iv = GN.fromJSBI(JSBI.BigInt(oracleResults[0].returnValues[2].hex), 12);
  // --> Factory
  const nSigma = factoryResults[0].returnValues[1] / 10;
  // --> token0 and token1
  const token0Raw = GN.fromJSBI(JSBI.BigInt(token0Results[0].returnValues[0].hex), token0.decimals);
  const token1Raw = GN.fromJSBI(JSBI.BigInt(token1Results[0].returnValues[0].hex), token1.decimals);
  // --> Uniswap pool
  const feeTier = uniswapResults[0].returnValues[0] as number;
  const fetchedUniswapPositions = new Map<string, UniswapPosition>();
  uniswapPositionKeys.forEach((key, i) => {
    const entry = uniswapResults.find((x) => x.reference === `positions-${key}`);
    const liquidity = JSBI.BigInt(entry?.returnValues[0].hex ?? '0x0');
    fetchedUniswapPositions.set(key, { ...uniswapPositionPriors[i], liquidity });
  });
  const uniswapPositions = Array.from(fetchedUniswapPositions.values());
  const { amount0: uni0, amount1: uni1 } = uniswapPositions.reduce(
    // Summing all positions' underlying liquidity at the current tick
    (p, c) => {
      const [amount0, amount1] = getAmountsForLiquidity(
        c.liquidity,
        c.lower,
        c.upper,
        TickMath.getTickAtSqrtRatio(sqrtPriceX96.toJSBI()),
        token0.decimals,
        token1.decimals
      );
      return {
        amount0: p.amount0.add(amount0),
        amount1: p.amount1.add(amount1),
      };
    },
    // Initial value:
    { amount0: GN.zero(token0.decimals), amount1: GN.zero(token1.decimals) }
  );

  return {
    marginAccount: {
      address: borrowerAddress,
      feeTier: NumericFeeTierToEnum(feeTier),
      sqrtPriceX96,
      uniswapPool,
      token0,
      token1,
      assets: {
        token0Raw,
        token1Raw,
        uni0,
        uni1,
      },
      liabilities,
      health: health.toNumber(),
      lender0,
      lender1,
      iv,
      nSigma,
    },
    uniswapPositions,
  };
}
