import Big from 'big.js';
import JSBI from 'jsbi';
import { FeeTier } from 'shared/lib/data/FeeTier';
import { Address } from 'wagmi';

import { UniswapPosition } from '../data/actions/Actions';
import { Assets, Liabilities, MarginAccount } from '../data/MarginAccount';
import { Token } from '../data/Token';

export type UniswapPositionParams = {
  lower: number;
  upper: number;
  liquidity: string;
};

export type MarketInfoParams = {
  lender0: Address;
  lender1: Address;
  borrowerAPR0: number;
  borrowerAPR1: number;
  lender0Utilization: number;
  lender1Utilization: number;
  lender0TotalSupply: string;
  lender1TotalSupply: string;
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
  marketInfo: MarketInfoParams;
};

export type CalculateLiquidationThresholdsParams = {
  marginAccount: MarginAccountParams;
  uniswapPositions: UniswapPositionParams[];
  sigma: number;
  iterations?: number;
  precision?: number;
};

export type ComputeLiquidationThresholdsRequest = {
  marginAccountParams: MarginAccountParams;
  uniswapPositionParams: UniswapPositionParams[];
  sigma: number;
  iterations?: number;
  precision?: number;
};

export function stringifyMarginAccount(marginAccount: MarginAccount): MarginAccountParams {
  return {
    ...marginAccount,
    marketInfo: {
      ...marginAccount.marketInfo,
      lender0TotalSupply: marginAccount.marketInfo.lender0TotalSupply.toString(),
      lender1TotalSupply: marginAccount.marketInfo.lender1TotalSupply.toString(),
    },
    sqrtPriceX96: marginAccount.sqrtPriceX96.toString(),
  };
}

export function parseMarginAccountParams(marginAccount: MarginAccountParams): MarginAccount {
  return {
    ...marginAccount,
    marketInfo: {
      ...marginAccount.marketInfo,
      lender0TotalSupply: new Big(marginAccount.marketInfo.lender0TotalSupply),
      lender1TotalSupply: new Big(marginAccount.marketInfo.lender1TotalSupply),
    },
    sqrtPriceX96: new Big(marginAccount.sqrtPriceX96),
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
