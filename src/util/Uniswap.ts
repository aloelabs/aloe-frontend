import Big from 'big.js';
import { ethers } from 'ethers';

import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { toBig } from '../util/Numbers';
import JSBI from 'jsbi';
import { TickMath, tickToPrice as uniswapTickToPrice } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import { TokenData } from '../data/TokenData';

const Q48 = ethers.BigNumber.from('0x1000000000000')
const Q96 = ethers.BigNumber.from('0x1000000000000000000000000');

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

export function convertSqrtPriceX96(sqrtPriceX96: ethers.BigNumber): Big {
  const priceX96 = sqrtPriceX96.mul(sqrtPriceX96).div(Q96);
  return toBig(priceX96).div(toBig(Q96));
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
