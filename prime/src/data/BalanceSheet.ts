import { TickMath } from '@uniswap/v3-sdk';
import Big from 'big.js';
import JSBI from 'jsbi';

import { areWithinNSigDigs } from '../util/Numbers';
import { getAmountsForLiquidity, getValueOfLiquidity } from '../util/Uniswap';
import { UniswapPosition } from './actions/Actions';
import {
  ALOE_II_LIQUIDATION_INCENTIVE,
  ALOE_II_MAX_LEVERAGE,
  ALOE_II_SIGMA_MAX,
  ALOE_II_SIGMA_MIN,
  ALOE_II_SIGMA_SCALER,
  BIGQ96,
} from './constants/Values';
import { Assets, Liabilities, LiquidationThresholds } from './MarginAccount';

const MIN_TICK = new Big('4295128740');
const MAX_TICK = new Big('1461446703485210103287273052203988822378723970341');

function _computeProbePrices(sqrtMeanPriceX96: Big, sigma: number): [Big, Big] {
  sigma = Math.min(Math.max(ALOE_II_SIGMA_MIN, sigma), ALOE_II_SIGMA_MAX);
  sigma *= ALOE_II_SIGMA_SCALER;

  let a = sqrtMeanPriceX96.mul(new Big((1 - sigma) * 1e18).sqrt()).div(1e9);
  let b = sqrtMeanPriceX96.mul(new Big((1 + sigma) * 1e18).sqrt()).div(1e9);

  // Constrain to be within TickMath's MIN_TICK and MAX_TICK
  if (a.lt(MIN_TICK)) a = MIN_TICK;
  if (b.gt(MAX_TICK)) b = MAX_TICK;

  return [a, b];
}

function _computeLiquidationIncentive(
  assets0: number,
  assets1: number,
  liabilities0: number,
  liabilities1: number,
  token0Decimals: number,
  token1Decimals: number,
  sqrtPriceX96: Big
): number {
  const price = sqrtRatioToPrice(sqrtPriceX96, token0Decimals, token1Decimals);

  let reward = 0;
  if (liabilities0 > assets0) {
    const shortfall = liabilities0 - assets0;
    reward += (shortfall * price) / ALOE_II_LIQUIDATION_INCENTIVE;
  }
  if (liabilities1 > assets1) {
    const shortfall = liabilities1 - assets1;
    reward += shortfall / ALOE_II_LIQUIDATION_INCENTIVE;
  }
  return reward;
}

function _computeSolvencyBasics(
  assets: Assets,
  liabilities: Liabilities,
  uniswapPositions: readonly UniswapPosition[],
  sqrtPriceX96: Big,
  iv: number,
  token0Decimals: number,
  token1Decimals: number
) {
  const [a, b] = _computeProbePrices(sqrtPriceX96, iv);
  const priceA = sqrtRatioToPrice(a, token0Decimals, token1Decimals);
  const priceB = sqrtRatioToPrice(b, token0Decimals, token1Decimals);

  const mem = getAssets(assets, uniswapPositions, a, b, sqrtPriceX96, token0Decimals, token1Decimals);

  const liquidationIncentive = _computeLiquidationIncentive(
    mem.fixed0 + mem.fluid0C,
    mem.fixed1 + mem.fluid1C,
    liabilities.amount0,
    liabilities.amount1,
    token0Decimals,
    token1Decimals,
    sqrtPriceX96
  );

  const coeff = 1 + 1 / ALOE_II_MAX_LEVERAGE;
  const liabilities0 = liabilities.amount0 * coeff;
  const liabilities1 = liabilities.amount1 * coeff + liquidationIncentive;

  const liabilitiesA = liabilities1 + liabilities0 * priceA;
  const assetsA = mem.fluid1A + mem.fixed1 + mem.fixed0 * priceA;
  const liabilitiesB = liabilities1 + liabilities0 * priceB;
  const assetsB = mem.fluid1B + mem.fixed1 + mem.fixed0 * priceB;

  return {
    priceA,
    priceB,
    mem,
    liquidationIncentive,
    coeff,
    surplusA: assetsA - liabilitiesA,
    surplusB: assetsB - liabilitiesB,
  };
}

export function sqrtRatioToPrice(sqrtPriceX96: Big, token0Decimals: number, token1Decimals: number): number {
  return sqrtPriceX96
    .mul(sqrtPriceX96)
    .div(BIGQ96)
    .div(BIGQ96)
    .mul(10 ** (token0Decimals - token1Decimals))
    .toNumber();
}

export function priceToSqrtRatio(price: number, token0Decimals: number, token1Decimals: number): Big {
  return new Big(price)
    .mul(10 ** (token1Decimals - token0Decimals))
    .sqrt()
    .mul(BIGQ96);
}

export function getAssets(
  assets: Assets,
  uniswapPositions: readonly UniswapPosition[],
  a: Big,
  b: Big,
  c: Big,
  token0Decimals: number,
  token1Decimals: number
) {
  const tickA = TickMath.getTickAtSqrtRatio(JSBI.BigInt(a.toFixed(0)));
  const tickB = TickMath.getTickAtSqrtRatio(JSBI.BigInt(b.toFixed(0)));
  const tickC = TickMath.getTickAtSqrtRatio(JSBI.BigInt(c.toFixed(0)));

  let fluid1A = 0;
  let fluid1B = 0;
  let fluid0C = 0;
  let fluid1C = 0;

  for (const position of uniswapPositions) {
    const { liquidity, lower, upper } = position;
    if (lower === null || upper === null) {
      console.error('Attempted to sum up assets for account with malformed Uniswap Position');
      console.error(position);
      continue;
    }

    fluid1A += getValueOfLiquidity(liquidity, lower, upper, tickA, token1Decimals);
    fluid1B += getValueOfLiquidity(liquidity, lower, upper, tickB, token1Decimals);
    const temp = getAmountsForLiquidity(liquidity, lower, upper, tickC, token0Decimals, token1Decimals);
    fluid0C += temp[0];
    fluid1C += temp[1];
  }

  return {
    fixed0: assets.token0Raw,
    fixed1: assets.token1Raw,
    fluid1A,
    fluid1B,
    fluid0C,
    fluid1C,
  };
}

export function isSolvent(
  assets: Assets,
  liabilities: Liabilities,
  uniswapPositions: readonly UniswapPosition[],
  sqrtPriceX96: Big,
  iv: number,
  token0Decimals: number,
  token1Decimals: number
) {
  const { priceA, priceB, mem, liquidationIncentive, coeff } = _computeSolvencyBasics(
    assets,
    liabilities,
    uniswapPositions,
    sqrtPriceX96,
    iv,
    token0Decimals,
    token1Decimals
  );

  const liabilities0 = liabilities.amount0 * coeff;
  const liabilities1 = liabilities.amount1 * coeff + liquidationIncentive;

  const liabilitiesA = liabilities1 + liabilities0 * priceA;
  const assetsA = mem.fluid1A + mem.fixed1 + mem.fixed0 * priceA;
  const healthA = liabilitiesA > 0 ? assetsA / liabilitiesA : 1000;

  const liabilitiesB = liabilities1 + liabilities0 * priceB;
  const assetsB = mem.fluid1B + mem.fixed1 + mem.fixed0 * priceB;
  const healthB = liabilitiesB > 0 ? assetsB / liabilitiesB : 1000;

  return {
    priceA,
    priceB,
    assetsA,
    assetsB,
    liabilitiesA,
    liabilitiesB,
    atA: assetsA >= liabilitiesA,
    atB: assetsB >= liabilitiesB,
    health: Math.min(healthA, healthB),
  };
}

export function maxBorrows(
  assets: Assets,
  liabilities: Liabilities,
  uniswapPositions: readonly UniswapPosition[],
  sqrtPriceX96: Big,
  iv: number,
  token0Decimals: number,
  token1Decimals: number
) {
  const { priceA, priceB, surplusA, surplusB } = _computeSolvencyBasics(
    assets,
    liabilities,
    uniswapPositions,
    sqrtPriceX96,
    iv,
    token0Decimals,
    token1Decimals
  );

  const maxNewBorrowsA = surplusA * ALOE_II_MAX_LEVERAGE;
  const maxNewBorrowsB = surplusB * ALOE_II_MAX_LEVERAGE;

  const maxNewBorrows0 = Math.min(maxNewBorrowsA / priceA, maxNewBorrowsB / priceB);
  const maxNewBorrows1 = Math.min(maxNewBorrowsA, maxNewBorrowsB);
  return [maxNewBorrows0, maxNewBorrows1];
}

export function maxWithdraws(
  assets: Assets,
  liabilities: Liabilities,
  uniswapPositions: readonly UniswapPosition[],
  sqrtPriceX96: Big,
  iv: number,
  token0Decimals: number,
  token1Decimals: number,
  coeff = 1
) {
  const { priceA, priceB, mem, surplusA, surplusB } = _computeSolvencyBasics(
    assets,
    liabilities,
    uniswapPositions,
    sqrtPriceX96,
    iv,
    token0Decimals,
    token1Decimals
  );
  const priceC = sqrtRatioToPrice(sqrtPriceX96, token0Decimals, token1Decimals);

  const surplus0C = mem.fixed0 + mem.fluid0C - liabilities.amount0;
  const surplus1C = mem.fixed1 + mem.fluid1C - liabilities.amount1;

  let maxWithdrawA1 = surplusA;
  let denom = coeff;
  // Withdrawing token1 can only impact liquidation incentive if there's surplus token0
  if (surplus0C >= 0) {
    // `surplus1C <= 0` means there's no padding to absorb the new withdrawal, so it starts increasing the
    // liquidation incentive right away
    if (surplus1C <= 0) {
      denom = coeff + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
    }
    // In this case, `surplus1C` is big enough to absorb part of the new withdrawal, but not all of it. The
    // portion that's *not* absorbed will increase the liquidation incentive
    else if (surplus1C < maxWithdrawA1) {
      maxWithdrawA1 += surplus1C / ALOE_II_LIQUIDATION_INCENTIVE;
      denom = coeff + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
    }
  }
  maxWithdrawA1 /= denom;

  let maxWithdrawA0 = surplusA;
  denom = coeff * priceA;
  // Withdrawing token0 can only impact liquidation incentive if there's surplus token1
  if (surplus1C >= 0) {
    // `surplus0C <= 0` means there's no padding to absorb the new withdrawal, so it starts increasing the
    // liquidation incentive right away
    if (surplus0C <= 0) {
      denom = coeff * priceA + priceC / ALOE_II_LIQUIDATION_INCENTIVE;
    }
    // In this case, `surplus0C` is big enough to absorb part of the new withdrawal, but not all of it. The
    // portion that's *not* absorbed will increase the liquidation incentive
    else if (surplus0C < maxWithdrawA0 / priceA) {
      maxWithdrawA0 += (surplus0C * priceC) / ALOE_II_LIQUIDATION_INCENTIVE;
      denom = coeff * priceA + priceC / ALOE_II_LIQUIDATION_INCENTIVE;
    }
  }
  maxWithdrawA0 /= denom;

  // REPEAT AT PRICE B FOR TOKEN1

  let maxWithdrawB1 = surplusB;
  denom = coeff;
  if (surplus0C >= 0) {
    if (surplus1C <= 0) {
      denom = coeff + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
    } else if (surplus1C < maxWithdrawB1) {
      maxWithdrawB1 += surplus1C / ALOE_II_LIQUIDATION_INCENTIVE;
      denom = coeff + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
    }
  }
  maxWithdrawB1 /= denom;

  // REPEAT AT PRICE B FOR TOKEN0

  let maxWithdrawB0 = surplusB;
  denom = coeff * priceB;
  if (surplus1C >= 0) {
    if (surplus0C <= 0) {
      denom = coeff * priceB + priceC / ALOE_II_LIQUIDATION_INCENTIVE;
    } else if (surplus0C < maxWithdrawB0 / priceB) {
      maxWithdrawB0 += (surplus0C * priceC) / ALOE_II_LIQUIDATION_INCENTIVE;
      denom = coeff * priceB + priceC / ALOE_II_LIQUIDATION_INCENTIVE;
    }
  }
  maxWithdrawB0 /= denom;

  const maxNewWithdraws0 = Math.min(maxWithdrawA0, maxWithdrawB0, assets.token0Raw);
  const maxNewWithdraws1 = Math.min(maxWithdrawA1, maxWithdrawB1, assets.token1Raw);
  return [maxNewWithdraws0, maxNewWithdraws1];
}

export function computeLiquidationThresholds(
  assets: Assets,
  liabilities: Liabilities,
  uniswapPositions: UniswapPosition[],
  sqrtPriceX96: Big,
  iv: number,
  token0Decimals: number,
  token1Decimals: number,
  iterations: number = 120,
  precision: number = 7
): LiquidationThresholds {
  let result: LiquidationThresholds = {
    lower: 0,
    upper: 0,
  };

  const MINPRICE = new Big(TickMath.MIN_SQRT_RATIO.toString(10)).mul(1.23);
  const MAXPRICE = new Big(TickMath.MAX_SQRT_RATIO.toString(10)).div(1.23);

  // Find lower liquidation threshold
  const isSolventAtMin = isSolvent(assets, liabilities, uniswapPositions, MINPRICE, iv, token0Decimals, token1Decimals);
  if (isSolventAtMin.atA && isSolventAtMin.atB) {
    // if solvent at beginning, short-circuit
    result.lower = sqrtRatioToPrice(MINPRICE, token0Decimals, token1Decimals);
  } else {
    // Start binary search
    let lowerBoundSqrtPrice = MINPRICE;
    let upperBoundSqrtPrice = sqrtPriceX96;
    let searchPrice: Big = new Big(0);
    for (let i = 0; i < iterations; i++) {
      const prevSearchPrice = searchPrice;
      searchPrice = lowerBoundSqrtPrice.add(upperBoundSqrtPrice).div(2);
      if (areWithinNSigDigs(searchPrice, prevSearchPrice, precision)) {
        // binary search has converged
        break;
      }
      const isSolventAtSearchPrice = isSolvent(
        assets,
        liabilities,
        uniswapPositions,
        searchPrice,
        iv,
        token0Decimals,
        token1Decimals
      );
      const isLiquidatableAtSearchPrice = !isSolventAtSearchPrice.atA || !isSolventAtSearchPrice.atB;
      if (isLiquidatableAtSearchPrice) {
        // liquidation threshold is lower
        lowerBoundSqrtPrice = searchPrice;
      } else {
        // liquidation threshold is higher
        upperBoundSqrtPrice = searchPrice;
      }
    }
    result.lower = sqrtRatioToPrice(searchPrice, token0Decimals, token1Decimals);
  }

  // Find upper liquidation threshold
  const isSolventAtMax = isSolvent(assets, liabilities, uniswapPositions, MAXPRICE, iv, token0Decimals, token1Decimals);
  if (isSolventAtMax.atA && isSolventAtMax.atB) {
    // if solvent at end, short-circuit
    result.upper = sqrtRatioToPrice(MAXPRICE, token0Decimals, token1Decimals);
  } else {
    // Start binary search
    let lowerBoundSqrtPrice = sqrtPriceX96;
    let upperBoundSqrtPrice = MAXPRICE;
    let searchPrice: Big = new Big(0);
    for (let i = 0; i < iterations; i++) {
      const prevSearchPrice = searchPrice;
      searchPrice = lowerBoundSqrtPrice.add(upperBoundSqrtPrice).div(2);
      if (areWithinNSigDigs(searchPrice, prevSearchPrice, precision)) {
        // binary search has converged
        break;
      }
      const isSolventAtSearchPrice = isSolvent(
        assets,
        liabilities,
        uniswapPositions,
        searchPrice,
        iv,
        token0Decimals,
        token1Decimals
      );
      const isLiquidatableAtSearchPrice = !isSolventAtSearchPrice.atA || !isSolventAtSearchPrice.atB;
      if (isLiquidatableAtSearchPrice) {
        // liquidation threshold is higher
        upperBoundSqrtPrice = searchPrice;
      } else {
        // liquidation threshold is lower
        lowerBoundSqrtPrice = searchPrice;
      }
    }
    result.upper = sqrtRatioToPrice(searchPrice, token0Decimals, token1Decimals);
  }

  return result;
}

export function sumAssetsPerToken(assets: Assets): [number, number] {
  return [assets.token0Raw + assets.uni0, assets.token1Raw + assets.uni1];
}
