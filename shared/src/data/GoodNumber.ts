import Big, { BigConstructor, BigSource } from 'big.js';
import { BigNumber } from 'ethers';
import JSBI from 'jsbi';

import { formatTokenAmount, formatTokenAmountCompact } from '../util/Numbers';

export function scalerFor(base: 2 | 10, resolution: number) {
  if (base === 2) {
    if (resolution % 4 !== 0) throw new Error('Q number resolution must be a multiple of 4');
    return BigNumber.from(`0x1${'0'.repeat(resolution / 4)}`).toString();
  }

  return `1${'0'.repeat(resolution)}`;
}

function isInteger(x: Big) {
  return x.round(0, Big.roundDown).eq(x);
}

/**
 * @dev Any formatting option that results in loss of precision should be prefixed with "LOSSY"
 */
export enum GNFormat {
  INT,
  DECIMAL,
  DECIMAL_WITH_TRAILING_ZEROS,
  LOSSY_HUMAN,
  LOSSY_HUMAN_COMPACT,
}

export class GN {
  private Int: BigConstructor;

  private readonly base: 2 | 10;

  private readonly resolution: number;

  private readonly scaler: string;

  private readonly int: Big;

  /**
   * Create a GN
   * @param int A string representation of the desired number. May be in normal or scientific notation.
   * Infinity, NaN and hexadecimal literal strings, e.g. '0xff', are not valid.
   * @param resolution The maximum number of decimals to keep for operations involving division (div, sqrt, pow)
   */
  private constructor(int: string, resolution: number, base: 2 | 10) {
    if (resolution !== Math.floor(resolution)) throw new Error('`resolution` must be a whole number');
    else if (resolution < 0) throw new Error('`resolution` cannot be negative');
    else if (resolution > 1e6) throw new Error('`resolution` cannot be larger than 1000000');

    this.Int = Big();
    this.Int.DP = 0;
    this.Int.NE = -1e6;
    this.Int.PE = +1e6;
    this.Int.RM = Big.roundDown;
    this.Int.strict = true;

    this.base = base;
    this.resolution = resolution;
    this.scaler = scalerFor(this.base, this.resolution);
    this.int = new this.Int(int);

    if (!isInteger(this.int)) {
      throw new Error('Tried to construct `GN` with non-integer string');
    }
  }

  private approxDP() {
    return Math.ceil(this.resolution * Math.log10(this.base));
  }

  private x() {
    const Decimal = Big();
    Decimal.DP = this.approxDP();
    Decimal.RM = Big.roundDown;

    return new Decimal(this.int.toFixed(0)).div(this.scaler);
  }

  /*//////////////////////////////////////////////////////////////
                              COMPARISON
  //////////////////////////////////////////////////////////////*/

  cmp(other: GN) {
    if (this.scaler !== other.scaler) {
      throw new Error(`scalers must match, got (${this.scaler}, ${other.scaler}) in cmp`);
    }
    return this.int.cmp(other.int);
  }

  eq(other: GN) {
    if (this.scaler !== other.scaler) {
      throw new Error(`scalers must match, got (${this.scaler}, ${other.scaler}) in eq`);
    }
    return this.int.eq(other.int);
  }

  gt(other: GN) {
    if (this.scaler !== other.scaler) {
      throw new Error(`scalers must match, got (${this.scaler}, ${other.scaler}) in gt`);
    }
    return this.int.gt(other.int);
  }

  gte(other: GN) {
    if (this.scaler !== other.scaler) {
      throw new Error(`scalers must match, got (${this.scaler}, ${other.scaler}) in gte`);
    }
    return this.int.gte(other.int);
  }

  lt(other: GN) {
    if (this.scaler !== other.scaler) {
      throw new Error(`scalers must match, got (${this.scaler}, ${other.scaler}) in lt`);
    }
    return this.int.lt(other.int);
  }

  lte(other: GN) {
    if (this.scaler !== other.scaler) {
      throw new Error(`scalers must match, got (${this.scaler}, ${other.scaler}) in lte`);
    }
    return this.int.lte(other.int);
  }

  /**
   * Checks if the `GN` is equal to zero.
   * @returns whether the `GN` is equal to zero.
   */
  isZero() {
    return this.int.eq('0');
  }

  /**
   * Checks if the `GN` is greater than zero.
   * @returns whether the `GN` is greater than zero.
   */
  isGtZero() {
    return this.int.gt('0');
  }

  static max(a: GN, b: GN) {
    return a.gt(b) ? a : b;
  }

  static min(a: GN, b: GN) {
    return a.lt(b) ? a : b;
  }

  /*//////////////////////////////////////////////////////////////
                              ARITHMETIC
  //////////////////////////////////////////////////////////////*/

  add(other: GN) {
    if (this.scaler !== other.scaler) {
      throw new Error(`scalers must match, got (${this.scaler}, ${other.scaler}) in add`);
    }
    return new GN(this.int.plus(other.int).toFixed(0), this.resolution, this.base);
  }

  sub(other: GN) {
    if (this.scaler !== other.scaler) {
      throw new Error(`scalers must match, got (${this.scaler}, ${other.scaler}) in sub`);
    }
    return new GN(this.int.minus(other.int).toFixed(0), this.resolution, this.base);
  }

  mul(other: GN) {
    return new GN(this.int.times(other.int).div(other.scaler).toFixed(0), this.resolution, this.base);
  }

  div(other: GN) {
    return new GN(this.int.times(other.scaler).div(other.int).toFixed(0), this.resolution, this.base);
  }

  sqrt() {
    return GN.fromDecimalBig(this.x().sqrt(), this.resolution);
  }

  square() {
    return this.mul(this);
  }

  recklessMul(other: BigSource) {
    other = new Big(other);
    if (!isInteger(other)) {
      console.warn(`recklessMul by non-integer (${other.toString()}) wouldn't be possible in the EVM. Be careful!`);
    }
    return new GN(this.int.times(other).toFixed(0), this.resolution, this.base);
  }

  recklessDiv(other: BigSource) {
    other = new Big(other);
    if (!isInteger(other)) {
      console.warn(`recklessMul by non-integer (${other.toString()}) wouldn't be possible in the EVM. Be careful!`);
    }
    return new GN(this.int.div(other).toFixed(0), this.resolution, this.base);
  }

  recklessAdd(other: BigSource) {
    other = new Big(other);
    if (!isInteger(other)) {
      console.warn(`recklessAdd by non-integer (${other.toString()}) wouldn't be possible in the EVM. Be careful!`);
    }
    return new GN(this.int.plus(other).toFixed(0), this.resolution, this.base);
  }

  recklessSub(other: BigSource) {
    other = new Big(other);
    if (!isInteger(other)) {
      console.warn(`recklessSub by non-integer (${other.toString()}) wouldn't be possible in the EVM. Be careful!`);
    }
    return new GN(this.int.minus(other).toFixed(0), this.resolution, this.base);
  }

  /*//////////////////////////////////////////////////////////////
                              CONVERSION
  //////////////////////////////////////////////////////////////*/

  toString(format = GNFormat.INT) {
    switch (format) {
      case GNFormat.INT:
        return this.int.toFixed(0);
      case GNFormat.DECIMAL:
        return this.x().toFixed();
      case GNFormat.DECIMAL_WITH_TRAILING_ZEROS:
        return this.x().toFixed(this.approxDP());
      case GNFormat.LOSSY_HUMAN:
        // TODO: Bring logic in here instead of calling formatTokenAmount
        return formatTokenAmount(this.x().toNumber());
      case GNFormat.LOSSY_HUMAN_COMPACT:
        // TODO: Bring logic in here instead of calling formatTokenAmountCompact
        return formatTokenAmountCompact(this.x().toNumber());
      // TODO: Other formatting options from `Numbers.ts`
    }
  }

  /**
   * Converts to `BigNumber` without loss of precision.
   * @returns Equivalent `BigNumber`
   */
  toBigNumber() {
    return BigNumber.from(this.toString(GNFormat.INT));
  }

  /**
   * Converts to `JSBI.BigInt` without loss of precision.
   * @returns Equivalent `JSBI.BigInt`
   */
  toJSBI() {
    return JSBI.BigInt(this.toString(GNFormat.INT));
  }

  /**
   * Converts to `Number` with a potential loss of precision.
   * @returns Equivalent `Number`
   * @deprecated
   */
  toNumber() {
    console.warn('toNumber should be avoided whenever possible');
    return this.x().toNumber();
  }

  setResolution(resolution: number) {
    return new GN(this.toString(GNFormat.INT), resolution, this.base);
  }

  static zero(decimals: number, base: 2 | 10 = 10) {
    return new GN('0', decimals, base);
  }

  /**
   * Converts a fixed-point integer (stored as a BigNumber) to a `GN`
   * @param int The fixed-point integer as a BigNumber
   * @param resolution The power of 2 or 10 used to compute the fixed-point scaling factor
   * @param base Whether the scaling factor should be a power of 2 or 10
   * @returns Equivalent `GN`
   *
   * @example
   * ```
   * const bn = await erc20.balanceOf(userAddress);
   * const decimals = await erc20.decimals();
   * const gn = GN.fromBigNumber(bn, decimals)
   * ```
   */
  static fromBigNumber(int: BigNumber, resolution: number, base: 2 | 10 = 10) {
    return new GN(int.toString(), resolution, base);
  }

  /**
   * Converts a fixed-point integer (stored as a BigInt) to a `GN`
   * @param int The fixed-point integer as a JSBI.BigInt
   * @param resolution The power of 2 or 10 used to compute the fixed-point scaling factor
   * @param base Whether the scaling factor should be a power of 2 or 10
   * @returns Equivalent `GN`
   *
   * @example
   * ```
   * const amount = GN.fromJSBI(JSBI.BigInt('1000001'), 6);
   * amount.toString(GNFormat.LOSSLESS_DECIMAL); // 1.000001
   * ```
   */
  static fromJSBI(int: JSBI, resolution: number, base: 2 | 10 = 10) {
    return new GN(int.toString(10), resolution, base);
  }

  /**
   * Converts a decimal number (stored as a Big) to a `GN`
   * @param x The decimal number as a Big. Decimal places beyond `decimals` will be cut off.
   * @param decimals The number's precision, i.e. the number of decimal places that should be printed
   * when expressing the number in standard notation.
   * @returns Equivalent `GN`
   */
  static fromDecimalBig(x: Big, decimals: number) {
    const base = 10;
    return new GN(x.mul(scalerFor(base, decimals)).toFixed(0), decimals, base);
  }

  /**
   * Converts a decimal number (stored as a string) to a `GN`. Useful for handling user input in text fields, e.g.
   * when they enter a token amount.
   * @param x The decimal number as a string. May be in standard or scientific notation. Decimal places
   * beyond `decimals` will be cut off.
   * @param decimals The number's precision, i.e. the number of decimal places that should be printed
   * when expressing the number in standard notation.
   * @returns Equivalent `GN`
   */
  static fromDecimalString(x: string, decimals: number) {
    return GN.fromDecimalBig(new Big(x), decimals);
  }

  /**
   * Converts a floating point JS number to a `GN`. NOT RECOMMENDED!!!
   * @param x The number
   * @param decimals The number's precision, i.e. the number of decimal places that should be printed
   * when expressing the number in standard notation.
   * @returns Equivalent `GN`
   */
  static fromNumber(x: number, decimals: number) {
    console.warn('GN.fromNumber should be avoided as much as possible');
    return GN.fromDecimalString(x.toFixed(decimals), decimals);
  }
}
