import Big from 'big.js';
import { ethers } from 'ethers';
import JSBI from 'jsbi';

import { Token } from '../Token';
import { UniswapPosition } from './Actions';

export function getTransferInActionArgs(token: Token, amount: number): string {
  const address = token.address;
  const bigAmount = new Big(amount.toFixed(Math.min(token.decimals, 20))).mul(10 ** token.decimals);

  return ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [address, bigAmount.toFixed(0)]);
}

export function getTransferOutActionArgs(token: Token, amount: number): string {
  const address = token.address;
  const bigAmount = new Big(amount.toFixed(Math.min(token.decimals, 20))).mul(10 ** token.decimals);

  return ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [address, bigAmount.toFixed(0)]);
}

export function getBorrowActionArgs(token0: Token, amount0: number, token1: Token, amount1: number): string {
  const bigAmount0 = new Big(amount0.toFixed(Math.min(token0.decimals, 20))).mul(10 ** token0.decimals);
  const bigAmount1 = new Big(amount1.toFixed(Math.min(token1.decimals, 20))).mul(10 ** token1.decimals);

  return ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [bigAmount0.toFixed(0), bigAmount1.toFixed(0)]);
}

export function getRepayActionArgs(token0: Token, amount0: number, token1: Token, amount1: number): string {
  const bigAmount0 = new Big(amount0.toFixed(Math.min(token0.decimals, 20))).mul(10 ** token0.decimals);
  const bigAmount1 = new Big(amount1.toFixed(Math.min(token1.decimals, 20))).mul(10 ** token1.decimals);

  return ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [bigAmount0.toFixed(0), bigAmount1.toFixed(0)]);
}

export function getAddLiquidityActionArgs(lower: number, upper: number, liquidity: JSBI): string {
  if (lower > upper) [lower, upper] = [upper, lower];
  return ethers.utils.defaultAbiCoder.encode(['int24', 'int24', 'uint128'], [lower, upper, liquidity.toString(10)]);
}

export function getRemoveLiquidityActionArgs(lower: number, upper: number, liquidity: JSBI): string {
  if (lower > upper) [lower, upper] = [upper, lower];
  return ethers.utils.defaultAbiCoder.encode(['int24', 'int24', 'uint128'], [lower, upper, liquidity.toString(10)]);
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
