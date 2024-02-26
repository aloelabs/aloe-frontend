import { GN } from 'shared/lib/data/GoodNumber';

export type OracleData = {
  iv: GN;
  sqrtPriceX96: GN;
  manipulationMetric: number;
};

export function asOracleData(multicallResult: any[]): OracleData {
  return {
    iv: GN.fromBigNumber(multicallResult[2], 12),
    sqrtPriceX96: GN.fromBigNumber(multicallResult[1], 96, 2),
    manipulationMetric: multicallResult[0].toNumber(),
  };
}
