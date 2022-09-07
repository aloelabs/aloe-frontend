import { FeeTier } from './FeeTier';
import { TokenData } from './TokenData';

export type Assets = {
  token0Raw: number;
  token1Raw: number;
  token0Plus: number;
  token1Plus: number;
  uni0: number;
  uni1: number;
};

export type Liabilities = {
  amount0: number;
  amount1: number;
};

export type MarginAccount = {
  address: string;
  token0: TokenData;
  token1: TokenData;
  feeTier: FeeTier;
  assets: Assets;
  liabilities: Liabilities;
};

export type AccountSummary = {
  assets: number;
  liabilities: number;
  lowerLiquidationThreshold: number;
  upperLiquidationThreshold: number;
};

export type AccountSummaries = [AccountSummary, AccountSummary];

export function calculateAccountSummaries(marginAccount: MarginAccount): AccountSummaries {
  const assets = marginAccount.assets;
  const liabilities = marginAccount.liabilities;
  return [
    {
      assets: assets.token0Raw + assets.token0Plus + assets.uni0,
      liabilities: liabilities.amount0,
      lowerLiquidationThreshold: 0,
      upperLiquidationThreshold: 0,
    },
    {
      assets: assets.token1Raw + assets.token1Plus + assets.uni1,
      liabilities: liabilities.amount1,
      lowerLiquidationThreshold: 0,
      upperLiquidationThreshold: 0,
    },
  ];
}

export function sumAssetsPerToken(assets: Assets): [number, number] {
  return [assets.token0Raw + assets.token0Plus + assets.uni0, assets.token1Raw + assets.token1Plus + assets.uni1];
}
