import { TickMath } from '@uniswap/v3-sdk';
import { GN } from 'shared/lib/data/GoodNumber';

import { getAmountsForLiquidity, getValueOfLiquidity } from '../util/Uniswap';
import { UniswapPosition } from './actions/Actions';
import {
  ALOE_II_LIQUIDATION_INCENTIVE,
  ALOE_II_MAX_LEVERAGE,
  ALOE_II_SIGMA_MAX,
  ALOE_II_SIGMA_MIN,
  ALOE_II_SIGMA_SCALER,
} from './constants/Values';
import { Assets, Liabilities, LiquidationThresholds } from './MarginAccount';

const MIN_SQRT_RATIO = GN.fromJSBI(TickMath.MIN_SQRT_RATIO, 96, 2);
const MAX_SQRT_RATIO = GN.fromJSBI(TickMath.MAX_SQRT_RATIO, 96, 2);
const ONE = GN.one(18);

function _computeProbePrices(sqrtMeanPriceX96: GN, sigma: GN): [GN, GN] {
  if (sigma.lt(ALOE_II_SIGMA_MIN)) sigma = ALOE_II_SIGMA_MIN;
  else if (sigma.gt(ALOE_II_SIGMA_MAX)) sigma = ALOE_II_SIGMA_MAX;

  sigma = sigma.recklessMul(ALOE_II_SIGMA_SCALER);

  let a = sqrtMeanPriceX96.mul(ONE.sub(sigma).sqrt());
  let b = sqrtMeanPriceX96.mul(ONE.add(sigma).sqrt());

  if (a.lt(MIN_SQRT_RATIO)) a = MIN_SQRT_RATIO.recklessAdd(1);
  if (b.gt(MAX_SQRT_RATIO)) b = MAX_SQRT_RATIO.recklessSub(1);

  return [a, b];
}

function _computeLiquidationIncentive(
  assets0: GN,
  assets1: GN,
  liabilities0: GN,
  liabilities1: GN,
  token0Decimals: number,
  token1Decimals: number,
  sqrtPriceX96: GN
): GN {
  const price = sqrtPriceX96.square();

  let reward = GN.zero(token1Decimals);
  if (liabilities0.gt(assets0)) {
    const shortfall = liabilities0.sub(assets0);
    reward = reward.add(shortfall.setResolution(token1Decimals).mul(price).recklessDiv(ALOE_II_LIQUIDATION_INCENTIVE));
  }
  if (liabilities1.gt(assets1)) {
    const shortfall = liabilities1.sub(assets1);
    reward = reward.add(shortfall.recklessDiv(ALOE_II_LIQUIDATION_INCENTIVE));
  }
  return reward;
}

function _computeSolvencyBasics(
  assets: Assets,
  liabilities: Liabilities,
  uniswapPositions: readonly UniswapPosition[],
  sqrtPriceX96: GN,
  iv: GN,
  token0Decimals: number,
  token1Decimals: number
) {
  const [a, b] = _computeProbePrices(sqrtPriceX96, iv);
  const priceA = a.square();
  const priceB = b.square();

  const mem = getAssets(assets, uniswapPositions, a, b, sqrtPriceX96, token0Decimals, token1Decimals);

  const liquidationIncentive = _computeLiquidationIncentive(
    mem.fixed0.add(mem.fluid0C),
    mem.fixed1.add(mem.fluid1C),
    liabilities.amount0,
    liabilities.amount1,
    token0Decimals,
    token1Decimals,
    sqrtPriceX96
  );

  const coeff = 1 + 1 / ALOE_II_MAX_LEVERAGE;
  const liabilities0 = liabilities.amount0.recklessMul(coeff);
  const liabilities1 = liabilities.amount1.recklessMul(coeff).add(liquidationIncentive);

  const liabilitiesA = liabilities1.add(liabilities0.setResolution(token1Decimals).mul(priceA));
  const assetsA = mem.fluid1A.add(mem.fixed1).add(mem.fixed0.setResolution(token1Decimals).mul(priceA));
  const liabilitiesB = liabilities1.add(liabilities0.setResolution(token1Decimals).mul(priceB));
  const assetsB = mem.fluid1B.add(mem.fixed1).add(mem.fixed0.setResolution(token1Decimals).mul(priceB));

  return {
    priceA,
    priceB,
    mem,
    liquidationIncentive,
    coeff,
    surplusA: assetsA.sub(liabilitiesA),
    surplusB: assetsB.sub(liabilitiesB),
  };
}

export function getAssets(
  assets: Assets,
  uniswapPositions: readonly UniswapPosition[],
  a: GN,
  b: GN,
  c: GN,
  token0Decimals: number,
  token1Decimals: number
) {
  const tickA = TickMath.getTickAtSqrtRatio(a.toJSBI());
  const tickB = TickMath.getTickAtSqrtRatio(b.toJSBI());
  const tickC = TickMath.getTickAtSqrtRatio(c.toJSBI());

  let fluid1A = GN.zero(token1Decimals);
  let fluid1B = GN.zero(token1Decimals);
  let fluid0C = GN.zero(token0Decimals);
  let fluid1C = GN.zero(token1Decimals);

  for (const position of uniswapPositions) {
    const { liquidity, lower, upper } = position;
    if (lower === null || upper === null) {
      console.error('Attempted to sum up assets for account with malformed Uniswap Position');
      console.error(position);
      continue;
    }

    fluid1A = fluid1A.add(getValueOfLiquidity(liquidity, lower, upper, tickA, token1Decimals));
    fluid1B = fluid1B.add(getValueOfLiquidity(liquidity, lower, upper, tickB, token1Decimals));
    const temp = getAmountsForLiquidity(liquidity, lower, upper, tickC, token0Decimals, token1Decimals);
    fluid0C = fluid0C.add(temp[0]);
    fluid1C = fluid1C.add(temp[1]);
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
  sqrtPriceX96: GN,
  iv: GN,
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

  const liabilities0 = liabilities.amount0.recklessMul(coeff);
  const liabilities1 = liabilities.amount1.recklessMul(coeff).add(liquidationIncentive);

  const liabilitiesA = liabilities1.add(liabilities0.setResolution(token1Decimals).mul(priceA));
  const assetsA = mem.fluid1A.add(mem.fixed1).add(mem.fixed0.setResolution(token1Decimals).mul(priceA));
  const healthA = liabilitiesA.isGtZero() ? assetsA.div(liabilitiesA).toNumber() : 1000;

  const liabilitiesB = liabilities1.add(liabilities0.setResolution(token1Decimals).mul(priceB));
  const assetsB = mem.fluid1B.add(mem.fixed1).add(mem.fixed0.setResolution(token1Decimals).mul(priceB));
  const healthB = liabilitiesB.isGtZero() ? assetsB.div(liabilitiesB).toNumber() : 1000;

  return {
    priceA,
    priceB,
    assetsA,
    assetsB,
    liabilitiesA,
    liabilitiesB,
    atA: assetsA.gte(liabilitiesA),
    atB: assetsB.gte(liabilitiesB),
    health: Math.min(healthA, healthB),
  };
}

export function maxBorrows(
  assets: Assets,
  liabilities: Liabilities,
  uniswapPositions: readonly UniswapPosition[],
  sqrtPriceX96: GN,
  iv: GN,
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

  const maxNewBorrowsA = surplusA.recklessMul(ALOE_II_MAX_LEVERAGE);
  const maxNewBorrowsB = surplusB.recklessMul(ALOE_II_MAX_LEVERAGE);

  // If the account is liquidatable, the math will yield negative numbers. Clamp them to 0.
  // Examples when this may happen:
  // - local price is less than the on-chain price (thus liquidation hasn't happened yet)
  // - account has been warned, but not actually liquidated yet
  const maxNewBorrows0 = GN.max(
    GN.min(maxNewBorrowsA.div(priceA), maxNewBorrowsB.div(priceB)).setResolution(token0Decimals),
    GN.zero(token0Decimals)
  );
  const maxNewBorrows1 = GN.max(GN.min(maxNewBorrowsA, maxNewBorrowsB), GN.zero(token1Decimals));
  return [maxNewBorrows0, maxNewBorrows1];
}

export function maxWithdraws(
  assets: Assets,
  liabilities: Liabilities,
  uniswapPositions: readonly UniswapPosition[],
  sqrtPriceX96: GN,
  iv: GN,
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
  const priceC = sqrtPriceX96.square();

  const surplus0C = mem.fixed0.add(mem.fluid0C).sub(liabilities.amount0);
  const surplus1C = mem.fixed1.add(mem.fluid1C).sub(liabilities.amount1);

  let maxWithdrawA1 = surplusA;
  let denom1 = coeff;
  // Withdrawing token1 can only impact liquidation incentive if there's surplus token0
  if (surplus0C.isGteZero()) {
    // `surplus1C <= 0` means there's no padding to absorb the new withdrawal, so it starts increasing the
    // liquidation incentive right away
    if (surplus1C.isLteZero()) {
      denom1 = coeff + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
    }
    // In this case, `surplus1C` is big enough to absorb part of the new withdrawal, but not all of it. The
    // portion that's *not* absorbed will increase the liquidation incentive
    else if (surplus1C.lt(maxWithdrawA1)) {
      maxWithdrawA1 = maxWithdrawA1.add(surplus1C.recklessDiv(ALOE_II_LIQUIDATION_INCENTIVE));
      denom1 = coeff + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
    }
  }
  maxWithdrawA1 = maxWithdrawA1.recklessDiv(denom1);

  let maxWithdrawA0 = surplusA;
  let denom0 = priceA.recklessMul(coeff);
  // Withdrawing token0 can only impact liquidation incentive if there's surplus token1
  if (surplus1C.isGteZero()) {
    // `surplus0C <= 0` means there's no padding to absorb the new withdrawal, so it starts increasing the
    // liquidation incentive right away
    if (surplus0C.isLteZero()) {
      denom0 = priceA.recklessMul(coeff).add(priceC.recklessDiv(ALOE_II_LIQUIDATION_INCENTIVE));
    }
    // In this case, `surplus0C` is big enough to absorb part of the new withdrawal, but not all of it. The
    // portion that's *not* absorbed will increase the liquidation incentive
    else if (surplus0C.lt(maxWithdrawA0.setResolution(token0Decimals).div(priceA))) {
      maxWithdrawA0 = maxWithdrawA0.add(
        surplus0C.setResolution(token1Decimals).mul(priceC).recklessDiv(ALOE_II_LIQUIDATION_INCENTIVE)
      );
      denom0 = priceA.recklessMul(coeff).add(priceC.recklessDiv(ALOE_II_LIQUIDATION_INCENTIVE));
    }
  }
  maxWithdrawA0 = maxWithdrawA0.setResolution(token0Decimals).div(denom0);

  // REPEAT AT PRICE B FOR TOKEN1

  let maxWithdrawB1 = surplusB;
  denom1 = coeff;
  if (surplus0C.isGteZero()) {
    if (surplus1C.isLteZero()) {
      denom1 = coeff + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
    } else if (surplus1C.lt(maxWithdrawB1)) {
      maxWithdrawB1 = maxWithdrawB1.add(surplus1C.recklessDiv(ALOE_II_LIQUIDATION_INCENTIVE));
      denom1 = coeff + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
    }
  }
  maxWithdrawB1 = maxWithdrawB1.recklessDiv(denom1);

  // REPEAT AT PRICE B FOR TOKEN0

  let maxWithdrawB0 = surplusB;
  denom0 = priceB.recklessMul(coeff);
  if (surplus1C.isGteZero()) {
    if (surplus0C.isLteZero()) {
      denom0 = priceB.recklessMul(coeff).add(priceC.recklessDiv(ALOE_II_LIQUIDATION_INCENTIVE));
    } else if (surplus0C.lt(maxWithdrawB0.setResolution(token0Decimals).div(priceB))) {
      maxWithdrawB0 = maxWithdrawB0.add(
        surplus0C.setResolution(token1Decimals).mul(priceC).recklessDiv(ALOE_II_LIQUIDATION_INCENTIVE)
      );
      denom0 = priceB.recklessMul(coeff).add(priceC.recklessDiv(ALOE_II_LIQUIDATION_INCENTIVE));
    }
  }
  maxWithdrawB0 = maxWithdrawB0.setResolution(token0Decimals).div(denom0);

  // If the account is liquidatable, the math will yield negative numbers. Clamp them to 0.
  // Examples when this may happen:
  // - local price is less than the on-chain price (thus liquidation hasn't happened yet)
  // - account has been warned, but not actually liquidated yet
  const maxNewWithdraws0 = GN.max(GN.min(maxWithdrawA0, maxWithdrawB0, assets.token0Raw), GN.zero(token0Decimals));
  const maxNewWithdraws1 = GN.max(GN.min(maxWithdrawA1, maxWithdrawB1, assets.token1Raw), GN.zero(token1Decimals));
  return [maxNewWithdraws0, maxNewWithdraws1];
}

function priceToNumber(price: GN, scaler: number, inTermsOfToken0 = false) {
  const priceNumber = price.toDecimalBig().mul(scaler).toNumber();
  return inTermsOfToken0 ? 1 / priceNumber : priceNumber;
}

export function computeLiquidationThresholds(
  assets: Assets,
  liabilities: Liabilities,
  uniswapPositions: UniswapPosition[],
  sqrtPriceX96: GN,
  iv: GN,
  token0Decimals: number,
  token1Decimals: number,
  iterations: number = 120,
  precision: number = 7
): LiquidationThresholds {
  const zero = GN.zero(96, 2);

  let result: LiquidationThresholds = {
    lower: 0,
    upper: 0,
  };

  const BOUND_L = MIN_SQRT_RATIO.recklessMul('123').recklessDiv('100');
  const BOUND_R = MAX_SQRT_RATIO.recklessDiv('123').recklessMul('100');
  const scaler = 10 ** (token0Decimals - token1Decimals);

  // Find lower liquidation threshold
  const isSolventAtMin = isSolvent(assets, liabilities, uniswapPositions, BOUND_L, iv, token0Decimals, token1Decimals);
  if (isSolventAtMin.atA && isSolventAtMin.atB) {
    // if solvent at beginning, short-circuit
    result.lower = priceToNumber(BOUND_L.square(), scaler, false);
  } else {
    // Start binary search
    let lowerBoundSqrtPrice = BOUND_L;
    let upperBoundSqrtPrice = sqrtPriceX96;
    let searchPrice = zero;
    for (let i = 0; i < iterations; i++) {
      const prevSearchPrice = searchPrice;
      searchPrice = lowerBoundSqrtPrice.add(upperBoundSqrtPrice).recklessDiv('2');
      if (GN.firstNSigDigsMatch(searchPrice, prevSearchPrice, precision)) {
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
    result.lower = priceToNumber(searchPrice.square(), scaler, false);
  }

  // Find upper liquidation threshold
  const isSolventAtMax = isSolvent(assets, liabilities, uniswapPositions, BOUND_R, iv, token0Decimals, token1Decimals);
  if (isSolventAtMax.atA && isSolventAtMax.atB) {
    // if solvent at end, short-circuit
    result.upper = BOUND_R.square().toNumber();
  } else {
    // Start binary search
    let lowerBoundSqrtPrice = sqrtPriceX96;
    let upperBoundSqrtPrice = BOUND_R;
    let searchPrice = zero;
    for (let i = 0; i < iterations; i++) {
      const prevSearchPrice = searchPrice;
      searchPrice = lowerBoundSqrtPrice.add(upperBoundSqrtPrice).recklessDiv('2');
      if (GN.firstNSigDigsMatch(searchPrice, prevSearchPrice, precision)) {
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
    result.upper = priceToNumber(searchPrice.square(), scaler, false);
  }

  return result;
}

export function sumAssetsPerToken(assets: Assets): [GN, GN] {
  return [assets.token0Raw.add(assets.uni0), assets.token1Raw.add(assets.uni1)];
}
