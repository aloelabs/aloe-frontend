import JSBI from 'jsbi';
import { FeeTier } from 'shared/lib/data/FeeTier';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { Address } from 'wagmi';

import { UniswapPosition } from '../data/actions/Actions';
import { Assets, Liabilities, MarginAccount } from '../data/MarginAccount';

export type UniswapPositionParams = {
  lower: number;
  upper: number;
  liquidity: string;
};

export type MarginAccountParams = {
  address: string;
  uniswapPool: string;
  token0: Token;
  token1: Token;
  feeTier: FeeTier;
  assets: Assets;
  liabilities: Liabilities;
  sqrtPriceX96: string;
  health: number;
  lender0: Address;
  lender1: Address;
  iv: string;
};

export type CalculateLiquidationThresholdsParams = {
  marginAccount: MarginAccountParams;
  uniswapPositions: UniswapPositionParams[];
  iterations?: number;
  precision?: number;
};

export type ComputeLiquidationThresholdsRequest = {
  marginAccountParams: MarginAccountParams;
  uniswapPositionParams: UniswapPositionParams[];
  iterations?: number;
  precision?: number;
};

export function stringifyMarginAccount(marginAccount: MarginAccount): MarginAccountParams {
  return {
    ...marginAccount,
    sqrtPriceX96: marginAccount.sqrtPriceX96.toString(GNFormat.INT),
    iv: marginAccount.iv.toString(GNFormat.INT),
  };
}

export function parseMarginAccountParams(marginAccount: MarginAccountParams): MarginAccount {
  return {
    ...marginAccount,
    sqrtPriceX96: new GN(marginAccount.sqrtPriceX96, 96, 2),
    iv: new GN(marginAccount.iv, 18, 10),
  };
}

export function stringifyUniswapPositions(positions: UniswapPosition[]): UniswapPositionParams[] {
  return positions.map((position: UniswapPosition) => {
    return {
      ...position,
      liquidity: position.liquidity.toString(),
    };
  });
}

export function parseUniswapPositionParams(positions: UniswapPositionParams[]): UniswapPosition[] {
  return positions.map((position: UniswapPositionParams) => {
    return {
      ...position,
      liquidity: JSBI.BigInt(position.liquidity),
    };
  });
}
