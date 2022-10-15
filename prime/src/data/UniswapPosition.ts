import JSBI from 'jsbi';
import { getAmountsForLiquidity } from '../util/Uniswap';

export class UniswapPosition {
  _lower: number | null;
  _upper: number | null;
  _liquidity: JSBI;

  constructor(lower: number | null, upper: number | null, liquidity: JSBI) {
    this._lower = lower;
    this._upper = upper;
    this._liquidity = liquidity;
  }

  get lower() {
    return this._lower;
  }

  get upper() {
    return this._upper;
  }

  get liquidity() {
    return this._liquidity;
  }

  set lower(lower: number | null) {
    this._lower = lower;
  }

  set upper(upper: number | null) {
    this._upper = upper;
  }

  set liquidity(liquidity: JSBI) {
    this._liquidity = liquidity;
  }

  async amount0(currentTick: number, token0Decimals: number, token1Decimals: number) {
    return getAmountsForLiquidity(
      this._liquidity,
      this._lower ?? 0,
      this._upper ?? 0,
      currentTick,
      token0Decimals,
      token1Decimals
    )[0];
  }

  async amount1(currentTick: number, token0Decimals: number, token1Decimals: number) {
    return getAmountsForLiquidity(
      this._liquidity,
      this._lower ?? 0,
      this._upper ?? 0,
      currentTick,
      token0Decimals,
      token1Decimals
    )[1];
  }
}
