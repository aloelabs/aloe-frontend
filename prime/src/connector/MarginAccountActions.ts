import { ethers } from 'ethers';
import Big from 'big.js';
import JSBI from 'jsbi';

import { TokenData } from '../data/TokenData';

export function getTransferInActionArgs(
  token: TokenData,
  amount: number
): string {
  const address = token.address;
  const bigAmount = new Big(amount.toFixed(Math.min(token.decimals, 20))).mul(
    10 ** token.decimals
  );

  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256'],
    [address, bigAmount.toFixed(0)]
  );
}

export function getTransferOutActionArgs(
  token: TokenData,
  amount: number
): string {
  const address = token.address;
  const bigAmount = new Big(amount.toFixed(Math.min(token.decimals, 20))).mul(
    10 ** token.decimals
  );

  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256'],
    [address, bigAmount.toFixed(0)]
  );
}

export function getMintActionArgs(
  token: TokenData,
  kitty: TokenData,
  amount: number
): string {
  const address = kitty.address;
  const bigAmount = new Big(amount.toFixed(Math.min(token.decimals, 20))).mul(
    10 ** token.decimals
  );

  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256'],
    [address, bigAmount.toFixed(0)]
  );
}

export function getBurnActionArgs(
  token: TokenData,
  kitty: TokenData,
  amount: number
): string {
  const address = kitty.address;
  const bigAmount = new Big(amount.toFixed(Math.min(token.decimals, 20))).mul(
    10 ** token.decimals
  );

  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256'],
    [address, bigAmount.toFixed(0)]
  );
}

export function getBorrowActionArgs(
  token0: TokenData,
  amount0: number,
  token1: TokenData,
  amount1: number
): string {
  const bigAmount0 = new Big(
    amount0.toFixed(Math.min(token0.decimals, 20))
  ).mul(10 ** token0.decimals);
  const bigAmount1 = new Big(
    amount1.toFixed(Math.min(token1.decimals, 20))
  ).mul(10 ** token1.decimals);

  return ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'uint256'],
    [bigAmount0.toFixed(0), bigAmount1.toFixed(0)]
  );
}

export function getRepayActionArgs(
  token0: TokenData,
  amount0: number,
  token1: TokenData,
  amount1: number
): string {
  const bigAmount0 = new Big(
    amount0.toFixed(Math.min(token0.decimals, 20))
  ).mul(10 ** token0.decimals);
  const bigAmount1 = new Big(
    amount1.toFixed(Math.min(token1.decimals, 20))
  ).mul(10 ** token1.decimals);

  return ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'uint256'],
    [bigAmount0.toFixed(0), bigAmount1.toFixed(0)]
  );
}

export function getAddLiquidityActionArgs(
  lower: number,
  upper: number,
  liquidity: JSBI
): string {
  if (lower > upper) [lower, upper] = [upper, lower];
  return ethers.utils.defaultAbiCoder.encode(
    ['int24', 'int24', 'uint128'],
    [lower, upper, liquidity.toString(10)]
  );
}

export function getRemoveLiquidityActionArgs(
  lower: number,
  upper: number,
  liquidity: JSBI
): string {
  if (lower > upper) [lower, upper] = [upper, lower];
  return ethers.utils.defaultAbiCoder.encode(
    ['int24', 'int24', 'uint128'],
    [lower, upper, liquidity.toString(10)]
  );
}
