import { FeeTier } from "./FeeTier";
import { TokenData } from "./TokenData";

export type Assets = {
  token0Raw: number;
  token1Raw: number;
  token0Debt: number;
  token1Debt: number;
  token0Plus: number;
  token1Plus: number;
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
