import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { GN } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';

import { UniswapPosition } from './Actions';

export function getTransferInActionArgs(token: Token, amount: GN): string {
  const address = token.address;

  return ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [address, amount.toBigNumber()]);
}

export function getTransferOutActionArgs(token: Token, amount: GN): string {
  const address = token.address;

  return ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [address, amount.toBigNumber()]);
}

export function getBorrowActionArgs(token0: Token, amount0: GN, token1: Token, amount1: GN): string {
  return ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [amount0.toBigNumber(), amount1.toBigNumber()]);
}

export function getRepayActionArgs(token0: Token, amount0: GN, token1: Token, amount1: GN): string {
  return ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [amount0.toBigNumber(), amount1.toBigNumber()]);
}

export function getAddLiquidityActionArgs(lower: number, upper: number, liquidity: JSBI): string {
  if (lower > upper) [lower, upper] = [upper, lower];
  return ethers.utils.defaultAbiCoder.encode(['int24', 'int24', 'uint128'], [lower, upper, liquidity.toString(10)]);
}

export function getRemoveLiquidityActionArgs(lower: number, upper: number, liquidity: JSBI): string {
  if (lower > upper) [lower, upper] = [upper, lower];
  return ethers.utils.defaultAbiCoder.encode(['int24', 'int24', 'uint128'], [lower, upper, liquidity.toString(10)]);
}

/**
 * Get the FrontendManager arguments necessary to swap one token for another
 * @param token0 Data for the first token in the pair
 * @param amount0 If negative, the amount of `token0` to sell. If positive, the amount of `token0` we expect to receive
 * @param token1 Data for the second token in the pair
 * @param amount1 If negative, the amount of `token1` to sell. If positive, the amount of `token1` we expect to receive
 * @returns
 */
export function getSwapActionArgs(token0: Token, amount0: GN, token1: Token, amount1: GN): string {
  const assetIn = amount0.isLtZero() ? token0.address : token1.address;

  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'int256', 'int256'],
    [assetIn, amount0.toBigNumber(), amount1.toBigNumber()]
  );
}

function modQ24(value: number) {
  return value & 0b00000000111111111111111111111111;
}

export function zip(uniswapPositions: readonly UniswapPosition[]) {
  const positions: number[] = [];
  uniswapPositions.forEach((position) => {
    if (!JSBI.EQ(position.liquidity, JSBI.BigInt(0))) {
      positions.push(position.lower);
      positions.push(position.upper);
    }
  });
  while (positions.length < 6) {
    positions.push(0xdead);
  }

  const Q24 = 1 << 24;
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] >= 0) continue;
    positions[i] = modQ24(Q24 + positions[i]);
  }

  const zipped = positions.reduce((prev, curr, i) => {
    return JSBI.add(prev, JSBI.leftShift(JSBI.BigInt(curr), JSBI.BigInt(24 * i)));
  }, JSBI.BigInt(0));

  return zipped.toString(10);
}
