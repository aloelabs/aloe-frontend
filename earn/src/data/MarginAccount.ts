import Big from 'big.js';
import { Assets, Liabilities } from 'shared/lib/data/Borrower';
import { FeeTier } from 'shared/lib/data/FeeTier';
import { GN } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { Address, Hex } from 'viem';

/**
 * For the use-cases that require all of the data
 */
export type MarginAccount = {
  address: Address;
  uniswapPool: Address;
  token0: Token;
  token1: Token;
  feeTier: FeeTier;
  assets: Assets;
  liabilities: Liabilities;
  sqrtPriceX96: Big;
  health: number;
  lender0: Address;
  lender1: Address;
  iv: number;
  nSigma: number;
  userDataHex: Hex;
  warningTime: number;
  ethBalance?: GN;
};

/**
 * For the use-cases that may not require all of the data
 * (When we don't want to fetch more than we need)
 */
export type MarginAccountPreview = Omit<MarginAccount, 'sqrtPriceX96' | 'lender0' | 'lender1' | 'iv'>;

export type UniswapPoolInfo = {
  token0: Token;
  token1: Token;
  fee: number;
};
