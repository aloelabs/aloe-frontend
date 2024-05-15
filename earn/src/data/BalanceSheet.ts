import { TickMath } from '@uniswap/v3-sdk';
import Big from 'big.js';
import JSBI from 'jsbi';
import { GN } from 'shared/lib/data/GoodNumber';
import { areWithinNSigDigs } from 'shared/lib/util/Numbers';

import { ALOE_II_LIQUIDATION_INCENTIVE, ALOE_II_MAX_LEVERAGE, BIGQ96 } from './constants/Values';
import { Assets, Liabilities } from './MarginAccount';

const MIN_SQRT_RATIO = new Big('4295128740');
const MAX_SQRT_RATIO = new Big('1461446703485210103287273052203988822378723970341');

const PROBE_SQRT_SCALER_MIN = 1.026248453011;
const PROBE_SQRT_SCALER_MAX = 3.078745359035;

export function sqrtRatioToPrice(sqrtPriceX96: Big, token0Decimals: number, token1Decimals: number): number {
  return sqrtPriceX96
    .mul(sqrtPriceX96)
    .div(BIGQ96)
    .div(BIGQ96)
    .mul(10 ** (token0Decimals - token1Decimals))
    .toNumber();
}

export function sqrtRatioToTick(sqrtRatioX96: Big): number {
  const sqrtRatioX96JSBI = JSBI.BigInt(sqrtRatioX96.toFixed(0));
  return TickMath.getTickAtSqrtRatio(sqrtRatioX96JSBI);
}

function _computeProbePrices(sqrtMeanPriceX96: Big, iv: number, nSigma: number): [Big, Big] {
  const sqrtScaler = Math.max(PROBE_SQRT_SCALER_MIN, Math.min(Math.exp((nSigma * iv) / 2), PROBE_SQRT_SCALER_MAX));

  const prices = {
    a: sqrtMeanPriceX96.div(sqrtScaler),
    b: sqrtMeanPriceX96.mul(sqrtScaler),
    c: sqrtMeanPriceX96,
  };

  return [
    prices.a.gt(MIN_SQRT_RATIO) ? prices.a : MIN_SQRT_RATIO,
    prices.b.lt(MAX_SQRT_RATIO) ? prices.b : MAX_SQRT_RATIO,
  ];
}

function _solvency(
  sqrtPriceX96: Big,
  assets0: number,
  assets1: number,
  liabilities0: number,
  liabilities1: number,
  token0Decimals: number,
  token1Decimals: number
) {
  const price = sqrtRatioToPrice(sqrtPriceX96, token0Decimals, token1Decimals);
  const liabilities = liabilities1 + liabilities0 * price;
  const assets = assets1 + assets0 * price;
  return {
    isSolvent: assets >= liabilities,
    assets,
    liabilities,
  };
}

export function _getAssets(assets: Assets, a: Big, b: Big) {
  const tickA = TickMath.getTickAtSqrtRatio(JSBI.BigInt(a.toFixed(0)));
  const tickB = TickMath.getTickAtSqrtRatio(JSBI.BigInt(b.toFixed(0)));

  const [amount0AtA, amount1AtA] = assets.amountsAt(tickA);
  const [amount0AtB, amount1AtB] = assets.amountsAt(tickB);

  return {
    amount0AtA,
    amount1AtA,
    amount0AtB,
    amount1AtB,
  };
}

function _augmentLiabilities(liabilities0Or1: number, assets0Or1: number) {
  return (
    liabilities0Or1 +
    liabilities0Or1 / ALOE_II_MAX_LEVERAGE +
    Math.max(liabilities0Or1 - assets0Or1, 0) / ALOE_II_LIQUIDATION_INCENTIVE
  );
}

export function isHealthy(
  assets: Assets,
  liabilities: Liabilities,
  sqrtPriceX96: Big,
  iv: number,
  nSigma: number,
  token0Decimals: number,
  token1Decimals: number
) {
  const [a, b] = _computeProbePrices(sqrtPriceX96, iv, nSigma);
  const mem = _getAssets(assets, a, b);

  const { amount0: liabilities0, amount1: liabilities1 } = liabilities;

  let augmented0: number;
  let augmented1: number;

  augmented0 = _augmentLiabilities(liabilities0, mem.amount0AtA);
  augmented1 = _augmentLiabilities(liabilities1, mem.amount1AtA);
  const {
    isSolvent: atA,
    assets: assetsA,
    liabilities: liabilitiesA,
  } = _solvency(a, mem.amount0AtA, mem.amount1AtA, augmented0, augmented1, token0Decimals, token1Decimals);

  augmented0 = _augmentLiabilities(liabilities0, mem.amount0AtB);
  augmented1 = _augmentLiabilities(liabilities1, mem.amount1AtB);
  const {
    isSolvent: atB,
    assets: assetsB,
    liabilities: liabilitiesB,
  } = _solvency(b, mem.amount0AtB, mem.amount1AtB, augmented0, augmented1, token0Decimals, token1Decimals);

  const healthA = liabilitiesA > 0 ? assetsA / liabilitiesA : 1000;
  const healthB = liabilitiesB > 0 ? assetsB / liabilitiesB : 1000;

  return {
    atA,
    atB,
    health: Math.min(healthA, healthB),
  };
}

function _maxLiabilities1AllElseConstant(price: number, assets0: number, assets1: number, liabilities0: number) {
  const assets = assets1 + assets0 * price;
  const augmented0 = _augmentLiabilities(liabilities0, assets0);

  const f = assets - augmented0 * price;
  const g = (assets0 - augmented0) * price > assets1 / ALOE_II_MAX_LEVERAGE;

  if (g) {
    const coeff = 1 + 1 / ALOE_II_MAX_LEVERAGE + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
    return (f + assets1 / ALOE_II_LIQUIDATION_INCENTIVE) / coeff;
  } else {
    const coeff = 1 + 1 / ALOE_II_MAX_LEVERAGE;
    return f / coeff;
  }
}

function _maxLiabilities0AllElseConstant(price: number, assets0: number, assets1: number, liabilities1: number) {
  const assets = assets1 + assets0 * price;
  const augmented1 = _augmentLiabilities(liabilities1, assets1);

  const f = (assets - augmented1) / price;
  const g = (assets1 - augmented1) / price > assets0 / ALOE_II_MAX_LEVERAGE;

  if (g) {
    const coeff = 1 + 1 / ALOE_II_MAX_LEVERAGE + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
    return (f + assets0 / ALOE_II_LIQUIDATION_INCENTIVE) / coeff;
  } else {
    const coeff = 1 + 1 / ALOE_II_MAX_LEVERAGE;
    return f / coeff;
  }
}

function _minAssets1AllElseConstant(price: number, assets0: number, liabilities0: number, liabilities1: number) {
  const augmented0 = _augmentLiabilities(liabilities0, assets0);

  const f = (augmented0 - assets0) * price + liabilities1 / (1 + 1 / ALOE_II_MAX_LEVERAGE);
  const g = (assets0 - augmented0) * price > liabilities1 / ALOE_II_MAX_LEVERAGE;

  if (g) {
    const coeff = 1 + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
    return (f + liabilities1 / ALOE_II_LIQUIDATION_INCENTIVE) / coeff;
  } else {
    const coeff = 1;
    return f / coeff;
  }
}

function _minAssets0AllElseConstant(price: number, assets1: number, liabilities0: number, liabilities1: number) {
  const augmented1 = _augmentLiabilities(liabilities1, assets1);

  const f = (augmented1 - assets1) / price + liabilities0 / (1 + 1 / ALOE_II_MAX_LEVERAGE);
  const g = (assets1 - augmented1) / price > liabilities0 / ALOE_II_MAX_LEVERAGE;

  if (g) {
    const coeff = 1 + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
    return (f + liabilities0 / ALOE_II_LIQUIDATION_INCENTIVE) / coeff;
  } else {
    const coeff = 1;
    return f / coeff;
  }
}

export function maxWithdraws(
  assets: Assets,
  liabilities: Liabilities,
  sqrtPriceX96: Big,
  iv: number,
  nSigma: number,
  token0Decimals: number,
  token1Decimals: number
) {
  const [a, b] = _computeProbePrices(sqrtPriceX96, iv, nSigma);
  const mem = _getAssets(assets, a, b);

  const priceA = sqrtRatioToPrice(a, token0Decimals, token1Decimals);
  const priceB = sqrtRatioToPrice(b, token0Decimals, token1Decimals);

  const min0A = _minAssets0AllElseConstant(priceA, mem.amount1AtA, liabilities.amount0, liabilities.amount1);
  const min1A = _minAssets1AllElseConstant(priceA, mem.amount0AtA, liabilities.amount0, liabilities.amount1);
  const min0B = _minAssets0AllElseConstant(priceB, mem.amount1AtB, liabilities.amount0, liabilities.amount1);
  const min1B = _minAssets1AllElseConstant(priceB, mem.amount0AtB, liabilities.amount0, liabilities.amount1);

  const min0 = Math.max(min0A, min0B);
  const min1 = Math.max(min1A, min1B);
  return [Math.max(0, assets.amount0.toNumber() - min0), Math.max(0, assets.amount1.toNumber() - min1)];
}

export function maxBorrowAndWithdraw(
  assets: Assets,
  liabilities: Liabilities,
  sqrtPriceX96: Big,
  iv: number,
  nSigma: number,
  token0Decimals: number,
  token1Decimals: number
) {
  const [a, b] = _computeProbePrices(sqrtPriceX96, iv, nSigma);
  const mem = _getAssets(assets, a, b);

  const priceA = sqrtRatioToPrice(a, token0Decimals, token1Decimals);
  const priceB = sqrtRatioToPrice(b, token0Decimals, token1Decimals);

  const max0A = _maxLiabilities0AllElseConstant(priceA, mem.amount0AtA, mem.amount1AtA, liabilities.amount1);
  const max1A = _maxLiabilities1AllElseConstant(priceA, mem.amount0AtA, mem.amount1AtA, liabilities.amount0);
  const max0B = _maxLiabilities0AllElseConstant(priceB, mem.amount0AtB, mem.amount1AtB, liabilities.amount1);
  const max1B = _maxLiabilities1AllElseConstant(priceB, mem.amount0AtB, mem.amount1AtB, liabilities.amount0);

  const max0 = Math.min(max0A, max0B);
  const max1 = Math.min(max1A, max1B);
  return [max0 - liabilities.amount0, max1 - liabilities.amount1];
}

export type LiquidationThresholds = {
  lowerSqrtRatio: Big;
  upperSqrtRatio: Big;
  minSqrtRatio: Big;
  maxSqrtRatio: Big;
};

export function computeLiquidationThresholds(
  assets: Assets,
  liabilities: Liabilities,
  sqrtPriceX96: Big,
  iv: number,
  nSigma: number,
  token0Decimals: number,
  token1Decimals: number,
  iterations: number = 120,
  precision: number = 7
): LiquidationThresholds {
  const MINPRICE = new Big(2 ** 40);
  const MAXPRICE = new Big(TickMath.MAX_SQRT_RATIO.toString(10)).div(PROBE_SQRT_SCALER_MAX);

  let result: LiquidationThresholds = {
    lowerSqrtRatio: new Big('0'),
    upperSqrtRatio: new Big('0'),
    minSqrtRatio: MINPRICE,
    maxSqrtRatio: MAXPRICE,
  };

  // Find lower liquidation threshold
  const isSolventAtMin = isHealthy(assets, liabilities, MINPRICE, iv, nSigma, token0Decimals, token1Decimals);
  if (isSolventAtMin.atA && isSolventAtMin.atB) {
    // if solvent at beginning, short-circuit
    result.lowerSqrtRatio = MINPRICE;
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
      const isSolventAtSearchPrice = isHealthy(
        assets,
        liabilities,
        searchPrice,
        iv,
        nSigma,
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
    result.lowerSqrtRatio = searchPrice;
  }

  // Find upper liquidation threshold
  const isSolventAtMax = isHealthy(assets, liabilities, MAXPRICE, iv, nSigma, token0Decimals, token1Decimals);
  if (isSolventAtMax.atA && isSolventAtMax.atB) {
    // if solvent at end, short-circuit
    result.upperSqrtRatio = MAXPRICE;
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
      const isSolventAtSearchPrice = isHealthy(
        assets,
        liabilities,
        searchPrice,
        iv,
        nSigma,
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
    result.upperSqrtRatio = searchPrice;
  }

  return result;
}

export function computeLTV(iv: number, nSigma: number) {
  const ltv = 1 / ((1 + 1 / ALOE_II_MAX_LEVERAGE + 1 / ALOE_II_LIQUIDATION_INCENTIVE) * Math.exp(iv * nSigma));
  return Math.max(0.1, Math.min(ltv, 0.9));
}

const Q = 22.8811827075;
const R = 103567.889099532;
const S = 0.95;
const M = 20.405429;
const N = 7 * 24 * 60 * 60 - 5 * 60;

export function auctionCurve(auctionTimeSeconds: number) {
  if (auctionTimeSeconds >= N) return Infinity;
  return S + R / (N - auctionTimeSeconds) - Q / (M + auctionTimeSeconds);
}

// TODO: This can be cleaned up a lot once we have native BigInts
export function computeAuctionAmounts(
  sqrtPriceX96: GN,
  assets0: GN,
  assets1: GN,
  liabilities0: GN,
  liabilities1: GN,
  auctionTimeSeconds: number,
  closeFactor: number
) {
  let priceX128 = sqrtPriceX96.toJSBI();
  priceX128 = JSBI.divide(JSBI.multiply(priceX128, priceX128), GN.Q(64).toJSBI());

  let liabilities = JSBI.add(
    liabilities1.toJSBI(),
    JSBI.divide(JSBI.multiply(liabilities0.toJSBI(), priceX128), GN.Q(128).toJSBI())
  );
  let assets = JSBI.add(assets1.toJSBI(), JSBI.divide(JSBI.multiply(assets0.toJSBI(), priceX128), GN.Q(128).toJSBI()));

  if (auctionTimeSeconds < N) {
    liabilities = JSBI.divide(
      JSBI.multiply(liabilities, JSBI.BigInt((auctionCurve(auctionTimeSeconds) * 10_000).toFixed(0))),
      JSBI.BigInt(10_000)
    );

    if (JSBI.lessThan(liabilities, assets)) {
      assets0 = assets0.mul(GN.fromJSBI(liabilities, 0)).div(GN.fromJSBI(assets, 0));
      assets1 = assets1.mul(GN.fromJSBI(liabilities, 0)).div(GN.fromJSBI(assets, 0));
    }
  }

  return {
    out0: assets0.recklessMul(closeFactor),
    out1: assets1.recklessMul(closeFactor),
    repay0: liabilities0.recklessMul(closeFactor),
    repay1: liabilities1.recklessMul(closeFactor),
  };
}
