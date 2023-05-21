import JSBI from 'jsbi';
import { FeeTier } from 'shared/lib/data/FeeTier';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { MarginAccount } from 'shared/lib/data/MarginAccount';
import { Token } from 'shared/lib/data/Token';
import { Address } from 'wagmi';

import { UniswapPosition } from '../data/actions/Actions';

export type UniswapPositionParams = {
  lower: number;
  upper: number;
  liquidity: string;
};

export type AssetsParams = {
  token0Raw: string;
  token1Raw: string;
  uni0: string;
  uni1: string;
};

export type LiabilitiesParams = {
  amount0: string;
  amount1: string;
};

export type MarginAccountParams = {
  address: string;
  uniswapPool: string;
  token0: Token;
  token1: Token;
  feeTier: FeeTier;
  assets: AssetsParams;
  liabilities: LiabilitiesParams;
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
    assets: {
      token0Raw: marginAccount.assets.token0Raw.toString(GNFormat.INT),
      token1Raw: marginAccount.assets.token1Raw.toString(GNFormat.INT),
      uni0: marginAccount.assets.uni0.toString(GNFormat.INT),
      uni1: marginAccount.assets.uni1.toString(GNFormat.INT),
    },
    liabilities: {
      amount0: marginAccount.liabilities.amount0.toString(GNFormat.INT),
      amount1: marginAccount.liabilities.amount1.toString(GNFormat.INT),
    },
    sqrtPriceX96: marginAccount.sqrtPriceX96.toString(GNFormat.INT),
    iv: marginAccount.iv.toString(GNFormat.INT),
  };
}

export function parseMarginAccountParams(marginAccount: MarginAccountParams): MarginAccount {
  return {
    ...marginAccount,
    assets: {
      token0Raw: new GN(marginAccount.assets.token0Raw, marginAccount.token0.decimals, 10),
      token1Raw: new GN(marginAccount.assets.token1Raw, marginAccount.token1.decimals, 10),
      uni0: new GN(marginAccount.assets.uni0, marginAccount.token0.decimals, 10),
      uni1: new GN(marginAccount.assets.uni1, marginAccount.token1.decimals, 10),
    },
    liabilities: {
      amount0: new GN(marginAccount.liabilities.amount0, marginAccount.token0.decimals, 10),
      amount1: new GN(marginAccount.liabilities.amount1, marginAccount.token1.decimals, 10),
    },
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
