import Big from 'big.js';
import { ethers } from 'ethers';

import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { toBig } from '../util/Numbers';

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
  const Q96 = ethers.BigNumber.from('0x1000000000000000000000000');
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
