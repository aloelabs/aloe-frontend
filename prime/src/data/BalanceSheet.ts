import { TickMath } from '@uniswap/v3-sdk';
import Big from 'big.js';
import { GN } from 'shared/lib/data/GoodNumber';

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

const MIN_SQRT_RATIO = 4295128740; // TODO: replace with GN
const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970341; //TODO: replace with GN
const ONE = GN.one(18);

function _computeProbePrices(sqrtMeanPriceX96: GN, sigma: GN): [GN, GN] {
  if (sigma.lt(ALOE_II_SIGMA_MIN)) sigma = ALOE_II_SIGMA_MIN;
  else if (sigma.gt(ALOE_II_SIGMA_MAX)) sigma = ALOE_II_SIGMA_MAX;

  sigma = sigma.mul(ALOE_II_SIGMA_SCALER);

  let a = sqrtMeanPriceX96.mul(ONE.sub(sigma).sqrt()).recklessDiv('1e9');
  let b = sqrtMeanPriceX96.mul(ONE.add(sigma).sqrt()).recklessDiv('1e9');

  if (a.lt(MIN_SQRT_RATIO)) a = MIN_SQRT_RATIO;
  if (b.gt(MAX_SQRT_RATIO)) b = MAX_SQRT_RATIO;

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
  if (liabilities0 > assets0) {
    const shortfall = liabilities0.sub(assets0);
    reward = reward.add(shortfall.mul(price).setResolution(token1Decimals).recklessDiv(ALOE_II_LIQUIDATION_INCENTIVE));
  }
  if (liabilities1 > assets1) {
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

  const liabilitiesA = liabilities1.add(liabilities0.mul(priceA).setResolution(token1Decimals));
  const assetsA = mem.fluid1A.add(mem.fixed1).add(mem.fixed0.mul(priceA).setResolution(token1Decimals));
  const liabilitiesB = liabilities1.add(liabilities0.mul(priceB).setResolution(token1Decimals));
  const assetsB = mem.fluid1B.add(mem.fixed1).add(mem.fixed0.mul(priceB).setResolution(token1Decimals));

  return {
    priceA,
    priceB,
    mem,
    liquidationIncentive,
    coeff,
    surplusA: assetsA.add(liabilitiesA),
    surplusB: assetsB.add(liabilitiesB),
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

  const liabilitiesA = liabilities1.add(liabilities0.mul(priceA).setResolution(token1Decimals));
  const assetsA = mem.fluid1A.add(mem.fixed1).add(mem.fixed0.mul(priceA).setResolution(token1Decimals));
  const healthA = liabilitiesA.isGtZero()
    ? assetsA.recklessMul(1e18).div(liabilitiesA).setResolution(18).toNumber()
    : 1000;

  const liabilitiesB = liabilities1.add(liabilities0.mul(priceB).setResolution(token1Decimals));
  const assetsB = mem.fluid1B.add(mem.fixed1).add(mem.fixed0.mul(priceB).setResolution(token1Decimals));
  const healthB = liabilitiesB.isGtZero()
    ? assetsB.recklessMul(1e18).div(liabilitiesB).setResolution(18).toNumber()
    : 1000;

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
    GN.min(maxNewBorrowsA.div(priceA), maxNewBorrowsB.div(priceB)),
    GN.zero(token0Decimals)
  );
  const maxNewBorrows1 = GN.max(GN.min(maxNewBorrowsA, maxNewBorrowsB), GN.zero(token1Decimals));
  return [maxNewBorrows0, maxNewBorrows1];
}

// TODO: For Hayden to finish
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

  // If the account is liquidatable, the math will yield negative numbers. Clamp them to 0.
  // Examples when this may happen:
  // - local price is less than the on-chain price (thus liquidation hasn't happened yet)
  // - account has been warned, but not actually liquidated yet
  const maxNewWithdraws0 = Math.max(Math.min(maxWithdrawA0, maxWithdrawB0, assets.token0Raw), 0);
  const maxNewWithdraws1 = Math.max(Math.min(maxWithdrawA1, maxWithdrawB1, assets.token1Raw), 0);
  return [maxNewWithdraws0, maxNewWithdraws1];
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
  let result: LiquidationThresholds = {
    lower: GN.zero(96, 2), //TODO: check
    upper: GN.zero(96, 2), //TODO: check
  };

  const MINPRICE = GN.fromJSBI(TickMath.MIN_SQRT_RATIO, 96, 2).recklessMul(123).recklessDiv(100);
  const MAXPRICE = GN.fromJSBI(TickMath.MAX_SQRT_RATIO, 96, 2).recklessDiv(123).recklessMul(100);

  // Find lower liquidation threshold
  const isSolventAtMin = isSolvent(assets, liabilities, uniswapPositions, MINPRICE, iv, token0Decimals, token1Decimals);
  if (isSolventAtMin.atA && isSolventAtMin.atB) {
    // if solvent at beginning, short-circuit
    result.lower = MINPRICE.square();
  } else {
    // Start binary search
    let lowerBoundSqrtPrice = MINPRICE;
    let upperBoundSqrtPrice = sqrtPriceX96;
    let searchPrice: GN = GN.zero(96, 2);
    for (let i = 0; i < iterations; i++) {
      const prevSearchPrice = searchPrice;
      searchPrice = lowerBoundSqrtPrice.add(upperBoundSqrtPrice).recklessDiv('2');
      if (GN.areWithinNSigDigs(searchPrice, prevSearchPrice, precision)) {
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
    result.lower = searchPrice.square();
  }

  // Find upper liquidation threshold
  const isSolventAtMax = isSolvent(assets, liabilities, uniswapPositions, MAXPRICE, iv, token0Decimals, token1Decimals);
  if (isSolventAtMax.atA && isSolventAtMax.atB) {
    // if solvent at end, short-circuit
    result.upper = MAXPRICE.square();
  } else {
    // Start binary search
    let lowerBoundSqrtPrice = sqrtPriceX96;
    let upperBoundSqrtPrice = MAXPRICE;
    let searchPrice: GN = GN.zero(96, 2);
    for (let i = 0; i < iterations; i++) {
      const prevSearchPrice = searchPrice;
      searchPrice = lowerBoundSqrtPrice.add(upperBoundSqrtPrice).recklessDiv('2');
      if (GN.areWithinNSigDigs(searchPrice, prevSearchPrice, precision)) {
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
    result.upper = searchPrice.square();
  }

  return result;
}

export function sumAssetsPerToken(assets: Assets): [GN, GN] {
  return [assets.token0Raw.add(assets.uni0), assets.token1Raw.add(assets.uni1)];
}
