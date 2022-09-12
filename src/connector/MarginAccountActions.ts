import { BLOCKS_TO_WAIT, GAS_ESTIMATION_SCALING } from '../data/constants/Values';

import { ethers } from 'ethers';
import Big from 'big.js';
import JSBI from 'jsbi';

import { ActionCardState, ActionID } from '../data/Actions';
import { TokenData } from '../data/TokenData';

export function getTransferInActionArgs(token: TokenData, amount: number): string {
  const address = token.address;
  const bigAmount = new Big(amount.toFixed(Math.min(token.decimals, 20))).mul(10 ** token.decimals);

  return ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [address, bigAmount.toFixed(0)]);
}

export function getTransferOutActionArgs(token: TokenData, amount: number): string {
  const address = token.address;
  const bigAmount = new Big(amount.toFixed(Math.min(token.decimals, 20))).mul(10 ** token.decimals);

  return ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [address, bigAmount.toFixed(0)]);
}

export function getMintActionArgs(token: TokenData, kitty: TokenData, amount: number): string {
  const address = kitty.address;
  const bigAmount = new Big(amount.toFixed(Math.min(token.decimals, 20))).mul(10 ** token.decimals);

  return ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [address, bigAmount.toFixed(0)]);
}

export function getBurnActionArgs(kitty: TokenData, amount: number): string {
  const address = kitty.address;
  const bigAmount = new Big(amount.toFixed(Math.min(kitty.decimals, 20))).mul(10 ** 18);

  return ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [address, bigAmount.toFixed(0)]);
}

export function getBorrowActionArgs(token0: TokenData, amount0: number, token1: TokenData, amount1: number): string {
  const bigAmount0 = new Big(amount0.toFixed(Math.min(token0.decimals, 20))).mul(10 ** token0.decimals);
  const bigAmount1 = new Big(amount1.toFixed(Math.min(token1.decimals, 20))).mul(10 ** token1.decimals);

  return ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [bigAmount0.toFixed(0), bigAmount1.toFixed(0)]);
}

export function getRepayActionArgs(token0: TokenData, amount0: number, token1: TokenData, amount1: number): string {
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

//TODO: Check if this is correct (it probably isn't)
export function getSwapActionArgs(token0: TokenData, amount0: number, token1: TokenData, amount1: number): string {
  const bigAmount0 = new Big(amount0.toFixed(Math.min(token0.decimals, 20))).mul(10 ** token0.decimals);
  const bigAmount1 = new Big(amount1.toFixed(Math.min(token1.decimals, 20))).mul(10 ** token1.decimals);
  
  return ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [bigAmount0.toFixed(0), bigAmount1.toFixed(0)]);
}

export function getActionArgsFor(
  state: ActionCardState,
  token0: TokenData,
  token1: TokenData,
  kitty0: TokenData,
  kitty1: TokenData
): string | null {
  switch (state.actionId) {
    case ActionID.TRANSFER_IN:
      if (state.aloeResult?.token0RawDelta) return getTransferInActionArgs(token0, state.aloeResult.token0RawDelta);
      if (state.aloeResult?.token1RawDelta) return getTransferInActionArgs(token1, state.aloeResult.token1RawDelta);
      if (state.aloeResult?.token0PlusDelta) return getTransferInActionArgs(kitty0, state.aloeResult.token0PlusDelta);
      if (state.aloeResult?.token1PlusDelta) return getTransferInActionArgs(kitty1, state.aloeResult.token1PlusDelta);
      return null;

    case ActionID.TRANSFER_OUT:
      if (state.aloeResult?.token0RawDelta) return getTransferOutActionArgs(token0, -state.aloeResult.token0RawDelta);
      if (state.aloeResult?.token1RawDelta) return getTransferOutActionArgs(token1, -state.aloeResult.token1RawDelta);
      if (state.aloeResult?.token0PlusDelta) return getTransferOutActionArgs(kitty0, -state.aloeResult.token0PlusDelta);
      if (state.aloeResult?.token1PlusDelta) return getTransferOutActionArgs(kitty1, -state.aloeResult.token1PlusDelta);
      return null;

    case ActionID.MINT:
      if (state.aloeResult?.token0PlusDelta) return getMintActionArgs(token0, kitty0, state.aloeResult.token0PlusDelta);
      if (state.aloeResult?.token1PlusDelta) return getMintActionArgs(token1, kitty1, state.aloeResult.token1PlusDelta);
      return null;

    case ActionID.BURN:
      if (state.aloeResult?.token0PlusDelta) return getBurnActionArgs(kitty0, -state.aloeResult.token0PlusDelta);
      if (state.aloeResult?.token1PlusDelta) return getBurnActionArgs(kitty1, -state.aloeResult.token1PlusDelta);
      return null;

    case ActionID.BORROW:
      if (state.aloeResult?.token0DebtDelta)
        return getBorrowActionArgs(kitty0, state.aloeResult.token0DebtDelta, kitty1, 0);
      if (state.aloeResult?.token1DebtDelta)
        return getBorrowActionArgs(kitty0, 0, kitty1, state.aloeResult.token1DebtDelta);
      return null;

    case ActionID.REPAY:
      if (state.aloeResult?.token0DebtDelta)
        return getRepayActionArgs(kitty0, -state.aloeResult.token0DebtDelta, kitty1, 0);
      if (state.aloeResult?.token1DebtDelta)
        return getRepayActionArgs(kitty0, 0, kitty1, -state.aloeResult.token1DebtDelta);
      return null;

    case ActionID.ADD_LIQUIDITY:
      if (state.uniswapResult?.uniswapPosition) {
        const { lower, upper, liquidity } = state.uniswapResult.uniswapPosition;
        if (lower === null || upper === null) return null;

        return getAddLiquidityActionArgs(Math.min(lower, upper), Math.max(lower, upper), liquidity);
      }
      return null;

    case ActionID.REMOVE_LIQUIDITY:
      return null;

    case ActionID.SWAP:
      return null;

    default:
      return null;
  }
}
