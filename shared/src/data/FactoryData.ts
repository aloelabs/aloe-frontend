import { GN } from './GoodNumber';

export type FactoryData = {
  ante: GN;
  nSigma: number;
  manipulationThresholdDivisor: number;
  pausedUntilTime: number;
};

export function asFactoryData(multicallResult: readonly [bigint, number, number, number]): FactoryData {
  return {
    ante: GN.fromBigInt(multicallResult[0], 18),
    nSigma: (multicallResult[1] as number) / 10,
    manipulationThresholdDivisor: multicallResult[2],
    pausedUntilTime: multicallResult[3],
  };
}
