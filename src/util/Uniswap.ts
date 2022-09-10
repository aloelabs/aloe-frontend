import Big from 'big.js';
import { ethers } from 'ethers';

import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { roundDownToNearestN, roundUpToNearestN, toBig } from '../util/Numbers';
import JSBI from 'jsbi';
import { TickMath, tickToPrice as uniswapTickToPrice, maxLiquidityForAmounts, Position, Pool, SqrtPriceMath, nearestUsableTick, FeeAmount } from '@uniswap/v3-sdk';
import { MaxUint256, Token } from '@uniswap/sdk-core';
import { TokenData } from '../data/TokenData';
import { ApolloQueryResult } from '@apollo/react-hooks';
import { theGraphUniswapV3Client } from '../App';
import { UniswapTicksQuery } from './GraphQL';
import { FeeTier, GetNumericFeeTier } from '../data/FeeTier';
import { UniswapPosition } from '../data/Actions';

const BINS_TO_FETCH = 500;
export const Q48 = ethers.BigNumber.from('0x1000000000000')
export const Q96 = ethers.BigNumber.from('0x1000000000000000000000000');
const ONE = new Big('1.0');

export interface UniswapV3PoolSlot0 {
  sqrtPriceX96: ethers.BigNumber;
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
  return toBig(priceX96).div(toBig(Q96));
}

export function calculateTickInfo(poolBasics: UniswapV3PoolBasics, token0: TokenData, token1: TokenData, isToken0Selected: boolean): TickInfo {
  const tickSpacing = poolBasics.tickSpacing;
  const tickOffset = Math.floor(BINS_TO_FETCH * tickSpacing / 2);
  const minTick = roundDownToNearestN(poolBasics.slot0.tick - tickOffset, tickSpacing);
  const maxTick = roundUpToNearestN(poolBasics.slot0.tick + tickOffset, tickSpacing);
  const minPrice = parseFloat(tickToPrice(isToken0Selected ? minTick : maxTick, token0.decimals, token1.decimals, isToken0Selected));
  const maxPrice = parseFloat(tickToPrice(isToken0Selected ? maxTick : minTick, token0.decimals, token1.decimals, isToken0Selected));
  return {
    minTick,
    maxTick,
    minPrice,
    maxPrice,
    tickSpacing,
    tickOffset,
  }
}

export async function calculateTickData(poolAddress: string, poolBasics: UniswapV3PoolBasics): Promise<TickData[]> {
  const tickOffset = Math.floor(BINS_TO_FETCH * poolBasics.tickSpacing / 2);
  const minTick = poolBasics.slot0.tick - tickOffset;
  const maxTick = poolBasics.slot0.tick + tickOffset;

  const uniswapV3GraphQLTicksQueryResponse =
    (await theGraphUniswapV3Client.query({
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

  // console.log('Current Tick:');
  // console.log(currentTick);

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

  const tickData = tickDataLeft
    .reverse()
    .concat(...tickDataRight);

  return tickData;
}

/**
 * 
 * @returns the current tick for a given Uniswap pool
 */
export async function getUniswapPoolBasics(uniswapPoolAddress: string, provider: ethers.providers.BaseProvider): Promise<UniswapV3PoolBasics> {
  const pool = new ethers.Contract(uniswapPoolAddress, UniswapV3PoolABI, provider);

  const [slot0, tickSpacing] = await Promise.all([
    pool.slot0(),
    pool.tickSpacing(),
  ]);
  
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

export function tickToPrice(tick: number, token0Decimals: number, token1Decimals: number, isInTermsOfToken0=true): string {
  const sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick);
  const priceX192 = JSBI.multiply(sqrtPriceX96, sqrtPriceX96);
  const priceX96 = JSBI.signedRightShift(priceX192, JSBI.BigInt(96));

  const priceX96Big = new Big(priceX96.toString(10));

  const decimalDiff = token0Decimals - token1Decimals;
  const price0In1 = priceX96Big.mul(10 ** decimalDiff).div(Q96.toString()).toNumber();
  const price1In0 = 1.0 / price0In1;
  // console.log(tick, price0In1, price1In0);
  return isInTermsOfToken0 ? price0In1.toString() : price1In0.toString();
}

// export function tickToPrice2(token0: TokenData | null, token1: TokenData | null, tick: number) {
//   const uniswapToken0 = new Token(1, token0?.address || '', token0?.decimals || 18);
//   const uniswapToken1 = new Token(1, token1?.address || '', token1?.decimals || 18);
//   return uniswapTickToPrice(uniswapToken0, uniswapToken1, tick);
// }

export function priceToTick(price0In1: number, token0Decimals: number, token1Decimals: number): number {
  const decimalDiff = token0Decimals - token1Decimals;
  const priceX96 = new Big(price0In1).mul(Q96.toString()).div(10 ** decimalDiff);
  
  const sqrtPriceX48 = priceX96.sqrt();
  const sqrtPriceX96JSBI = JSBI.BigInt(sqrtPriceX48.mul(Q48.toString()).toFixed(0));
  return TickMath.getTickAtSqrtRatio(sqrtPriceX96JSBI);
}

export function shouldAmount0InputBeDisabled(lowerTick: number, upperTick: number, currentTick: number): boolean {
  return currentTick >= Math.max(lowerTick, upperTick);
}

export function shouldAmount1InputBeDisabled(lowerTick: number, upperTick: number, currentTick: number): boolean {
  return currentTick <= Math.min(lowerTick, upperTick);
}

export function calculateAmount1FromAmount0(amount0: number, lowerTick: number, upperTick: number, currentTick: number, token0Decimals: number, token1Decimals: number): {
  amount1: string,
  liquidity: JSBI
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
      amount1: '0',
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
    amount1: new Big(amount1.toString()).div(10 ** token1Decimals).toFixed(6),
    liquidity,
  };
}

export function calculateAmount0FromAmount1(amount1: number, lowerTick: number, upperTick: number, currentTick: number, token0Decimals: number, token1Decimals: number): {
  amount0: string,
  liquidity: JSBI,
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
      amount0: '0',
      liquidity,
    };
  }
  return {
    amount0: new Big(amount0.toString()).div(10 ** token0Decimals).toFixed(6),
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

export function getPoolAddressFromTokens(token0: TokenData, token1: TokenData, feeTier: FeeTier): string | null {
  //If in the future we want to use this with something besides ethereum, we will need to change the
  //chainId passed to the tokens.
  // const uniswapToken0 = new Token(1, token0.address, token0.decimals);
  // const uniswapToken1 = new Token(1, token1.address, token1.decimals);
  // const uniswapFeeAmount = feeTierToFeeAmount(feeTier);
  // if (uniswapFeeAmount == null) return null;
  // return Pool.getAddress(uniswapToken0, uniswapToken1, uniswapFeeAmount).toLowerCase();
  return '0xfbe57c73a82171a773d3328f1b563296151be515';
}

export function sumOfAssetsUsedForUniswapPositions(uniPos: UniswapPosition[]) : [number, number] {
  let token0Amount = 0;
  let token1Amount = 0;
  for (let pos of uniPos) {
    token0Amount += pos.amount0 || 0;
    token1Amount += pos.amount1 || 0;
  }
  return [token0Amount, token1Amount];
}

export function uniswapPositionKey(owner: string, lower: number, upper: number): string {
  return ethers.utils.solidityKeccak256(
    ['address', 'int24', 'int24'],
    [owner, lower, upper]
  );
}
