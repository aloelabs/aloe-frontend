import JSBI from 'jsbi';

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const SECONDS_PER_WEEK = 7 * 24 * 60 * 60;

export class RateModel {
  public static readonly A = JSBI.BigInt('610104633480000000000');
  public static readonly B = JSBI.subtract(
    JSBI.BigInt('1000000000000'),
    JSBI.divide(RateModel.A, JSBI.BigInt('1000000000000000000'))
  );

  static getAccrualFactor(elapsedTime: number, utilization: number): number {
    const rate = RateModel.computeYieldPerSecond(utilization);

    if (elapsedTime > SECONDS_PER_WEEK) elapsedTime = SECONDS_PER_WEEK;

    return (JSBI.toNumber(rate) / 1e12) ** elapsedTime;
  }

  static computeYieldPerSecond(utilization: number): JSBI {
    if (utilization > 1) utilization = 1;
    const u = JSBI.BigInt((utilization * 1e18).toFixed(0));

    if (JSBI.lessThan(u, JSBI.BigInt('990000000000000000'))) {
      // B + (A / (1e18 - utilization))
      return JSBI.add(RateModel.B, JSBI.divide(RateModel.A, JSBI.subtract(JSBI.BigInt('1000000000000000000'), u)));
    } else {
      return JSBI.BigInt('1000000060400');
    }
  }
}

export function yieldPerSecondToAPR(yieldPerSecond: JSBI): number {
  return (JSBI.toNumber(yieldPerSecond) / 1e12 - 1.0) * SECONDS_PER_YEAR;
}

export function borrowAPRToLendAPY(apr: number, utilization: number, reserveFactor: number) {
  const lendAPR = utilization * (1 - 1 / reserveFactor) * apr;
  return (1 + lendAPR / SECONDS_PER_YEAR) ** SECONDS_PER_YEAR - 1.0;
}
