import { GN } from 'shared/lib/data/GoodNumber';

export type Slot0Data = {
  sqrtPriceX96: GN;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
};

export function asSlot0Data(multicallResult: any[]): Slot0Data {
  return {
    sqrtPriceX96: GN.fromBigNumber(multicallResult[0], 96, 2),
    tick: multicallResult[1],
    observationIndex: multicallResult[2],
    observationCardinality: multicallResult[3],
    observationCardinalityNext: multicallResult[4],
    feeProtocol: multicallResult[5],
  };
}
