import { GN } from './GoodNumber';

export type Slot0Data = {
  sqrtPriceX96: GN;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
};

export function asSlot0Data(
  multicallResult: readonly [bigint, number, number, number, number, number, boolean]
): Slot0Data {
  return {
    sqrtPriceX96: GN.fromBigInt(multicallResult[0], 96, 2),
    tick: multicallResult[1],
    observationIndex: multicallResult[2],
    observationCardinality: multicallResult[3],
    observationCardinalityNext: multicallResult[4],
    feeProtocol: multicallResult[5],
  };
}
