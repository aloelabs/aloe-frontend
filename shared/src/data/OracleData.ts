import { GN } from './GoodNumber';

export type OracleData = {
  iv: GN;
  sqrtPriceX96: GN;
  manipulationMetric: number;
};

export function asOracleData(consult: readonly [bigint, bigint, bigint]): OracleData {
  return {
    iv: GN.fromBigInt(consult[2], 12),
    sqrtPriceX96: GN.fromBigInt(consult[1], 96, 2),
    manipulationMetric: Number(consult[0]),
  };
}
