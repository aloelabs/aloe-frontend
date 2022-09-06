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

export function sumAssetsPerToken(assets: Assets): [number, number] {
  return [assets.token0Raw + assets.token0Plus + assets.uni0, assets.token1Raw + assets.token1Plus + assets.uni1];
}
