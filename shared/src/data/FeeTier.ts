export enum FeeTier {
  UNKNOWN,
  INVALID,
  ZERO_ZERO_ONE,
  ZERO_ZERO_FIVE,
  ZERO_THREE,
  ONE,
}

export function PrintFeeTier(ft: FeeTier): string {
  switch (ft) {
    case FeeTier.ONE:
      return '1%';
    case FeeTier.ZERO_THREE:
      return '0.3%';
    case FeeTier.ZERO_ZERO_FIVE:
      return '0.05%';
    case FeeTier.ZERO_ZERO_ONE:
      return '0.01%';
    case FeeTier.INVALID:
      return 'INV';
    case FeeTier.UNKNOWN:
    default:
      return 'UNK';
  }
}

export function GetNumericFeeTier(ft: FeeTier | undefined): number {
  switch (ft) {
    case FeeTier.ONE:
      return 10000;
    case FeeTier.ZERO_THREE:
      return 3000;
    case FeeTier.ZERO_ZERO_FIVE:
      return 500;
    case FeeTier.ZERO_ZERO_ONE:
      return 100;
    case FeeTier.INVALID:
    case FeeTier.UNKNOWN:
    default:
      return 0;
  }
}

export function NumericFeeTierToEnum(ft: number): FeeTier {
  switch (ft) {
    case 100:
      return FeeTier.ZERO_ZERO_ONE;
    case 500:
      return FeeTier.ZERO_ZERO_FIVE;
    case 3000:
      return FeeTier.ZERO_THREE;
    case 10000:
      return FeeTier.ONE;
    default:
      return FeeTier.UNKNOWN;
  }
}
