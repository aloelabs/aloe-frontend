import { ApolloQueryResult } from '@apollo/react-hooks';
import { MaxUint256 } from '@uniswap/sdk-core';
import { Token as UniswapToken } from '@uniswap/sdk-core';
import { TickMath, maxLiquidityForAmounts, SqrtPriceMath, nearestUsableTick, FeeAmount, Pool } from '@uniswap/v3-sdk';
import Big from 'big.js';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { FeeTier, GetNumericFeeTier } from 'shared/lib/data/FeeTier';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { roundDownToNearestN, roundUpToNearestN, toBig } from 'shared/lib/util/Numbers';
import { chain } from 'wagmi';

import {
  theGraphUniswapV3ArbitrumClient,
  theGraphUniswapV3Client,
  theGraphUniswapV3GoerliClient,
  theGraphUniswapV3OptimismClient,
} from '../App';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { BIGQ96, Q96 } from '../data/constants/Values';
import { UniswapTicksQuery } from './GraphQL';

const BINS_TO_FETCH = 500;
const ONE = new Big('1.0');

export interface UniswapV3PoolSlot0 {
  sqrtPriceX96: GN;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
}

export interface UniswapV3PoolBasics {
  slot0: UniswapV3PoolSlot0;
  tickSpacing: number;
  token1OverToken0: Big;
}

export type TickInfo = {
  tickSpacing: number;
  tickOffset: number;
  minTick: number;
  maxTick: number;
  minPrice: number;
  maxPrice: number;
};

export type TickData = {
  tick: number;
  liquidity: Big;
  amount0: number;
  amount1: number;
  price1In0: number;
  price0In1: number;
  totalValueIn0: number;
};

export type UniswapV3GraphQLTick = {
  tickIdx: string;
  liquidityNet: string;
  price0: string;
  price1: string;
  __typename: string;
};

export type UniswapV3GraphQLTicksQueryResponse = {
  pools: {
    token0: { decimals: string };
    token1: { decimals: string };
    liquidity: string;
    tick: string;
    ticks: UniswapV3GraphQLTick[];
    __typename: string;
  }[];
};

export function convertSqrtPriceX96(sqrtPriceX96: ethers.BigNumber): Big {
  const priceX96 = sqrtPriceX96.mul(sqrtPriceX96).div(Q96);
  return toBig(priceX96).div(BIGQ96);
}

export function calculateTickInfo(
  poolBasics: UniswapV3PoolBasics,
  token0: Token,
  token1: Token,
  isToken0Selected: boolean
): TickInfo {
  const tickSpacing = poolBasics.tickSpacing;
  const tickOffset = Math.floor((BINS_TO_FETCH * tickSpacing) / 2);
  const minTick = roundDownToNearestN(poolBasics.slot0.tick - tickOffset, tickSpacing);
  const maxTick = roundUpToNearestN(poolBasics.slot0.tick + tickOffset, tickSpacing);
  const scaler = 10 ** (token0.decimals - token1.decimals);
  const minPrice = tickToPrice(minTick).toDecimalBig().mul(scaler).toNumber();
  const maxPrice = tickToPrice(maxTick).toDecimalBig().mul(scaler).toNumber();
  return {
    minTick,
    maxTick,
    minPrice: isToken0Selected ? minPrice : 1 / maxPrice, // TODO: these ternaries may be flipped
    maxPrice: isToken0Selected ? maxPrice : 1 / minPrice,
    tickSpacing,
    tickOffset,
  };
}

export async function calculateTickData(
  poolAddress: string,
  poolBasics: UniswapV3PoolBasics,
  chainId: number
): Promise<TickData[]> {
  const tickOffset = Math.floor((BINS_TO_FETCH * poolBasics.tickSpacing) / 2);
  const minTick = poolBasics.slot0.tick - tickOffset;
  const maxTick = poolBasics.slot0.tick + tickOffset;

  let theGraphClient = theGraphUniswapV3Client;
  switch (chainId) {
    case chain.arbitrum.id:
      theGraphClient = theGraphUniswapV3ArbitrumClient;
      break;
    case chain.optimism.id:
      theGraphClient = theGraphUniswapV3OptimismClient;
      break;
    case chain.goerli.id:
      theGraphClient = theGraphUniswapV3GoerliClient;
      break;
    case chain.mainnet.id:
    default:
      break;
  }

  const uniswapV3GraphQLTicksQueryResponse = (await theGraphClient.query({
    query: UniswapTicksQuery,
    variables: {
      poolAddress: poolAddress.toLowerCase(),
      minTick: minTick,
      maxTick: maxTick,
    },
  })) as ApolloQueryResult<UniswapV3GraphQLTicksQueryResponse>;
  if (!uniswapV3GraphQLTicksQueryResponse.data.pools) return [];
  const poolLiquidityData = uniswapV3GraphQLTicksQueryResponse.data.pools[0];

  const token0Decimals = Number(poolLiquidityData.token0.decimals);
  const token1Decimals = Number(poolLiquidityData.token1.decimals);
  const decimalFactor = new Big(10 ** (token1Decimals - token0Decimals));

  const currentLiquidity = new Big(poolLiquidityData.liquidity);
  const currentTick = Number(poolLiquidityData.tick);
  const rawTicksData = poolLiquidityData.ticks;

  const tickDataLeft: TickData[] = [];
  const tickDataRight: TickData[] = [];

  // MARK -- filling out data for ticks *above* the current tick
  let liquidity = currentLiquidity;
  let splitIdx = rawTicksData.length;

  for (let i = 0; i < rawTicksData.length; i += 1) {
    const rawTickData = rawTicksData[i];
    const tick = Number(rawTickData.tickIdx);
    if (tick <= currentTick) continue;

    // remember the first index above current tick so that search below current tick is more efficient
    if (i < splitIdx) splitIdx = i;

    liquidity = liquidity.plus(new Big(rawTickData.liquidityNet));
    const price0 = new Big(rawTickData.price0);
    const price1 = new Big(rawTickData.price1);

    const sqrtPL = price0.sqrt();
    const sqrtPU = price0.mul(new Big(1.0001).pow(poolBasics.tickSpacing)).sqrt();
    const amount0 = liquidity
      .mul(ONE.div(sqrtPL).minus(ONE.div(sqrtPU)))
      .div(10 ** token0Decimals)
      .toNumber();

    tickDataRight.push({
      tick,
      liquidity,
      amount0: amount0,
      amount1: 0,
      price1In0: price1.mul(decimalFactor).toNumber(),
      price0In1: price0.div(decimalFactor).toNumber(),
      totalValueIn0: amount0,
    });
  }

  // MARK -- filling out data for ticks *below* the current tick
  liquidity = currentLiquidity;

  for (let i = splitIdx - 1; i >= 0; i -= 1) {
    const rawTickData = rawTicksData[i];
    const tick = Number(rawTickData.tickIdx);
    if (tick > currentTick) continue;

    liquidity = liquidity.minus(new Big(rawTickData.liquidityNet));
    const price0 = new Big(rawTickData.price0);
    const price1 = new Big(rawTickData.price1);

    const sqrtPL = price0.sqrt();
    const sqrtPU = price0.mul(new Big(1.0001).pow(poolBasics.tickSpacing)).sqrt();
    const amount1 = liquidity
      .mul(sqrtPU.minus(sqrtPL))
      .div(10 ** token1Decimals)
      .toNumber();

    tickDataLeft.push({
      tick,
      liquidity,
      amount0: 0,
      amount1: amount1,
      price1In0: price1.mul(decimalFactor).toNumber(),
      price0In1: price0.div(decimalFactor).toNumber(),
      totalValueIn0: amount1 * price1.mul(decimalFactor).toNumber(),
    });
  }

  const tickData = tickDataLeft.reverse().concat(...tickDataRight);

  return tickData;
}

/**
 *
 * @returns the current tick for a given Uniswap pool
 */
export async function getUniswapPoolBasics(
  uniswapPoolAddress: string,
  provider: ethers.providers.BaseProvider
): Promise<UniswapV3PoolBasics> {
  const pool = new ethers.Contract(uniswapPoolAddress, UniswapV3PoolABI, provider);

  const [slot0, tickSpacing] = await Promise.all([pool.slot0(), pool.tickSpacing()]);

  return {
    slot0: {
      sqrtPriceX96: slot0.sqrtPriceX96,
      tick: slot0.tick,
      observationIndex: slot0.observationIndex,
      observationCardinality: slot0.observationCardinality,
      observationCardinalityNext: slot0.observationCardinalityNext,
      feeProtocol: slot0.feeProtocol,
    },
    tickSpacing: tickSpacing,
    token1OverToken0: convertSqrtPriceX96(slot0.sqrtPriceX96),
  };
}

export function tickToPrice(tick: number): GN {
  return GN.fromJSBI(TickMath.getSqrtRatioAtTick(tick), 96, 2).square();
}

/**
 * Converts a price to the closest tick
 * @param price0In1 the price of token0 in terms of token1
 * @param token0Decimals the number of decimals in token0
 * @param token1Decimals the number of decimals in token1
 * @returns the closest tick to the price
 */
export function priceToClosestTick(price0In1: number, token0Decimals: number, token1Decimals: number): number {
  const decimalDiff = token0Decimals - token1Decimals;
  const tick = (Math.log10(price0In1) - decimalDiff) / Math.log10(1.0001);
  return Math.round(tick);
}

export function sqrtRatioToTick(sqrtRatioX96: GN): number {
  const sqrtRatioX96JSBI = sqrtRatioX96.toJSBI();
  return TickMath.getTickAtSqrtRatio(sqrtRatioX96JSBI);
}

export function shouldAmount0InputBeDisabled(lowerTick: number, upperTick: number, currentTick: number): boolean {
  return currentTick >= Math.max(lowerTick, upperTick);
}

export function shouldAmount1InputBeDisabled(lowerTick: number, upperTick: number, currentTick: number): boolean {
  return currentTick <= Math.min(lowerTick, upperTick);
}

export function calculateAmount1FromAmount0(
  amount0: number,
  lowerTick: number,
  upperTick: number,
  currentTick: number,
  token0Decimals: number,
  token1Decimals: number
): {
  amount: string;
  liquidity: JSBI;
} {
  // If lowerTick > upperTick, flip them so that the var names match reality
  if (lowerTick > upperTick) [lowerTick, upperTick] = [upperTick, lowerTick];

  //lower price
  const sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(lowerTick);
  //upper price
  const sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(upperTick);
  //current price
  const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(currentTick);

  const bigAmount0 = JSBI.BigInt(new Big(amount0).mul(10 ** token0Decimals).toFixed(0));
  const liquidity = maxLiquidityForAmounts(sqrtRatioX96, sqrtRatioAX96, sqrtRatioBX96, bigAmount0, MaxUint256, true);

  let amount1 = JSBI.BigInt(0);
  if (currentTick <= lowerTick) {
    //current price < lower price
    //everything to the right of currentTick is token0. thus there's no token1 (amount1 = 0)
    return {
      amount: '0',
      liquidity,
    };
  } else if (currentTick < upperTick) {
    //lower price < current price < upper price
    //only stuff to the left of currentTick is token1. so we look between lowerTick and currentTick
    amount1 = SqrtPriceMath.getAmount1Delta(sqrtRatioAX96, sqrtRatioX96, liquidity, false);
  } else {
    //current price >= upper price
    //everything to the left of currentTick is token1. so we look between lowerTick and upperTick
    amount1 = SqrtPriceMath.getAmount1Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, false);
  }
  return {
    amount: new Big(amount1.toString()).div(10 ** token1Decimals).toFixed(token1Decimals),
    liquidity,
  };
}

export function calculateAmount0FromAmount1(
  amount1: number,
  lowerTick: number,
  upperTick: number,
  currentTick: number,
  token0Decimals: number,
  token1Decimals: number
): {
  amount: string;
  liquidity: JSBI;
} {
  if (lowerTick > upperTick) [lowerTick, upperTick] = [upperTick, lowerTick];

  //lower price
  const sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(lowerTick);
  //upper price
  const sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(upperTick);
  //current price
  const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(currentTick);

  const bigAmount1 = JSBI.BigInt(new Big(amount1).mul(10 ** token1Decimals).toFixed(0));
  const liquidity = maxLiquidityForAmounts(sqrtRatioX96, sqrtRatioAX96, sqrtRatioBX96, MaxUint256, bigAmount1, true);

  let amount0 = JSBI.BigInt(0);
  if (currentTick <= lowerTick) {
    //current price < lower price
    //everything to the right of currentTick is token0. so we look between lowerTick and upperTick
    amount0 = SqrtPriceMath.getAmount0Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, false);
  } else if (currentTick < upperTick) {
    //lower price < current price < upper price
    //only stuff to the right of currentTick is token0. so we look between currentTick and upperTick
    amount0 = SqrtPriceMath.getAmount0Delta(sqrtRatioX96, sqrtRatioBX96, liquidity, false);
  } else {
    //current price >= upper price
    //everything to the right of currentTick is token1. thus there's no token0 (amount0 = 0)
    return {
      amount: '0',
      liquidity,
    };
  }
  return {
    amount: new Big(amount0.toString()).div(10 ** token0Decimals).toFixed(token0Decimals),
    liquidity,
  };
}

export function getMinTick(tickSpacing: number) {
  return nearestUsableTick(TickMath.MIN_TICK, tickSpacing);
}

export function feeTierToFeeAmount(feeTier: FeeTier): FeeAmount | null {
  const numericFeeTier = GetNumericFeeTier(feeTier);
  if (numericFeeTier === 0) {
    //Invalid feeTier
    //TODO: we should probably throw an error
    return null;
  }
  return numericFeeTier as FeeAmount;
}

export function getPoolAddressFromTokens(token0: Token, token1: Token, feeTier: FeeTier, chainId: number): string {
  //If in the future we want to use this with something besides ethereum, we will need to change the
  //chainId passed to the tokens.
  const uniswapToken0 = new UniswapToken(chainId, token0.address, token0.decimals);
  const uniswapToken1 = new UniswapToken(chainId, token1.address, token1.decimals);
  const uniswapFeeAmount = feeTierToFeeAmount(feeTier);
  if (uniswapFeeAmount == null) return '';
  return Pool.getAddress(uniswapToken0, uniswapToken1, uniswapFeeAmount).toLowerCase();
}

export function uniswapPositionKey(owner: string, lower: number, upper: number): string {
  return ethers.utils.solidityKeccak256(['address', 'int24', 'int24'], [owner, lower, upper]);
}

function getAmount0ForLiquidity(sqrtRatioAX96: JSBI, sqrtRatioBX96: JSBI, liquidity: JSBI): JSBI {
  const res = JSBI.BigInt(96);
  const numerator = JSBI.multiply(JSBI.leftShift(liquidity, res), JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96));
  const denominator = JSBI.multiply(sqrtRatioBX96, sqrtRatioAX96);
  return JSBI.divide(numerator, denominator);
}

function getAmount1ForLiquidity(sqrtRatioAX96: JSBI, sqrtRatioBX96: JSBI, liquidity: JSBI): JSBI {
  const numerator = JSBI.multiply(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96));
  return JSBI.divide(numerator, JSBI.BigInt(Q96.toString()));
}

export function getAmountsForLiquidity(
  liquidity: JSBI,
  lowerTick: number,
  upperTick: number,
  currentTick: number,
  token0Decimals: number,
  token1Decimals: number
): [GN, GN] {
  if (lowerTick > upperTick) [lowerTick, upperTick] = [upperTick, lowerTick];

  //lower price
  const sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(lowerTick);
  //upper price
  const sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(upperTick);
  //current price
  const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(currentTick);

  let amount0 = JSBI.BigInt(0);
  let amount1 = JSBI.BigInt(0);

  if (currentTick <= lowerTick) {
    amount0 = getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
  } else if (currentTick < upperTick) {
    amount0 = getAmount0ForLiquidity(sqrtRatioX96, sqrtRatioBX96, liquidity);
    amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioX96, liquidity);
  } else {
    amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
  }

  return [GN.fromJSBI(amount0, token0Decimals), GN.fromJSBI(amount1, token1Decimals)];
}

export function getValueOfLiquidity(
  liquidity: JSBI,
  lowerTick: number,
  upperTick: number,
  currentTick: number,
  token1Decimals: number
): GN {
  if (lowerTick > upperTick) [lowerTick, upperTick] = [upperTick, lowerTick];

  //lower price
  const sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(lowerTick);
  //upper price
  const sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(upperTick);
  //current price
  const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(currentTick);

  let value0 = JSBI.BigInt(0);
  let value1 = JSBI.BigInt(0);

  const jsbiQ96 = JSBI.BigInt(Q96.toString());
  const res = JSBI.BigInt(96);

  if (currentTick <= lowerTick) {
    const priceX96 = JSBI.divide(JSBI.multiply(sqrtRatioX96, sqrtRatioX96), jsbiQ96);

    const numerator = JSBI.multiply(JSBI.leftShift(liquidity, res), JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96));
    const temp = JSBI.divide(numerator, sqrtRatioBX96);
    value0 = JSBI.divide(JSBI.multiply(priceX96, temp), JSBI.leftShift(sqrtRatioAX96, res));
  } else if (currentTick < upperTick) {
    //mulDiv(sqrtRatioX96, sqrtRatioBX96 - sqrtRatioX96, FixedPoint96.Q96)
    const numerator = JSBI.divide(JSBI.multiply(sqrtRatioX96, JSBI.subtract(sqrtRatioBX96, sqrtRatioX96)), jsbiQ96);
    value0 = JSBI.divide(JSBI.multiply(liquidity, numerator), sqrtRatioBX96);
    value1 = JSBI.divide(JSBI.multiply(liquidity, JSBI.subtract(sqrtRatioX96, sqrtRatioAX96)), jsbiQ96);
  } else {
    value1 = JSBI.divide(JSBI.multiply(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)), jsbiQ96);
  }

  const value = JSBI.add(value0, value1);

  return GN.fromJSBI(value, token1Decimals);
}

/**
 *
 * @param priceX96 the price of the input token in terms of the output token
 * @param amount the amount of the input token
 * @param isInputToken0 true if the input token is token0, false otherwise
 * @param outputDecimals the number of decimals of the output token
 * @param slippage a string representing the slippage in percentage (0.0-100.0)
 * @returns the amount of the output token
 */
export function getOutputForSwap(
  priceX96: GN,
  amount: GN,
  isInputToken0: boolean,
  outputDecimals: number,
  slippage: string
): string {
  // We use resolution of 5 to get basis-points resolution
  const slippageFactor = GN.one(5).sub(GN.fromDecimalString(slippage, 5).recklessDiv(100));

  if (isInputToken0) {
    return amount.mul(slippageFactor).setResolution(outputDecimals).mul(priceX96).toString(GNFormat.DECIMAL);
  } else {
    return amount.mul(slippageFactor).setResolution(outputDecimals).div(priceX96).toString(GNFormat.DECIMAL);
  }
}
