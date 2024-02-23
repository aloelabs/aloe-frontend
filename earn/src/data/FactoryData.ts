import { GN } from 'shared/lib/data/GoodNumber';

export type FactoryData = {
  ante: GN;
  nSigma: number;
  manipulationThresholdDivisor: number;
  pausedUntilTime: number;
};

export function asFactoryData(multicallResult: any[]): FactoryData {
  return {
    ante: GN.fromBigNumber(multicallResult[0], 18),
    nSigma: (multicallResult[1] as number) / 10,
    manipulationThresholdDivisor: multicallResult[2],
    pausedUntilTime: multicallResult[3],
  };
}
