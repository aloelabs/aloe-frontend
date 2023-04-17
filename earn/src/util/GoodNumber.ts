import Big, { BigConstructor, BigSource } from 'big.js';
import { BigNumber } from 'ethers';
import JSBI from 'jsbi';

import { formatTokenAmount, formatTokenAmountCompact } from './Numbers';

function scalerFor(decimals: number) {
  return `1${'0'.repeat(decimals)}`;
}

function isInteger(x: Big) {
  return x.round(0, Big.roundDown).eq(x);
}

export enum GNFormat {
  LOSSLESS_INT,
  LOSSLESS_DECIMAL,
  LOSSY_HUMAN,
  LOSSY_HUMAN_COMPACT,
}

export class GN {
  private Int: BigConstructor;

  private readonly decimals: number;

  private readonly scaler: string;

  private readonly int: Big;

  /**
   * Create a GN
   * @param int A string representation of the desired number. May be in normal or scientific notation.
   * Infinity, NaN and hexadecimal literal strings, e.g. '0xff', are not valid.
   * @param decimals The maximum number of decimals to keep for operations involving division (div, sqrt, pow)
   */
  private constructor(int: string, decimals: number) {
    if (decimals !== Math.floor(decimals)) throw new Error('`decimals` must be a whole number');
    else if (decimals < 0) throw new Error('`decimals` cannot be negative');
    else if (decimals > 1e6) throw new Error('`decimals` cannot be larger than 1000000');

    this.Int = Big();
    this.Int.DP = 0;
    this.Int.NE = -1e6;
    this.Int.PE = +1e6;
    this.Int.RM = Big.roundDown;
    this.Int.strict = true;

    this.decimals = decimals;
    this.scaler = scalerFor(this.decimals);
    this.int = new this.Int(int);

    if (!isInteger(this.int)) {
      throw new Error('Tried to construct `GN` with non-integer string');
    }
  }

  private x() {
    const Decimal = Big();
    Decimal.DP = this.decimals;
    Decimal.RM = Big.roundDown;

    return new Decimal(this.int.toFixed(0)).div(this.scaler);
  }

  /*//////////////////////////////////////////////////////////////
                              COMPARISON
  //////////////////////////////////////////////////////////////*/

  cmp(other: GN) {
    if (this.decimals !== other.decimals) {
      throw new Error(`decimals must match, got (${this.decimals}, ${other.decimals}) in cmp`);
    }
    return this.int.cmp(other.int);
  }

  eq(other: GN) {
    if (this.decimals !== other.decimals) {
      throw new Error(`decimals must match, got (${this.decimals}, ${other.decimals}) in eq`);
    }
    return this.int.eq(other.int);
  }

  gt(other: GN) {
    if (this.decimals !== other.decimals) {
      throw new Error(`decimals must match, got (${this.decimals}, ${other.decimals}) in gt`);
    }
    return this.int.gt(other.int);
  }

  gte(other: GN) {
    if (this.decimals !== other.decimals) {
      throw new Error(`decimals must match, got (${this.decimals}, ${other.decimals}) in gte`);
    }
    return this.int.gte(other.int);
  }

  lt(other: GN) {
    if (this.decimals !== other.decimals) {
      throw new Error(`decimals must match, got (${this.decimals}, ${other.decimals}) in lt`);
    }
    return this.int.lt(other.int);
  }

  lte(other: GN) {
    if (this.decimals !== other.decimals) {
      throw new Error(`decimals must match, got (${this.decimals}, ${other.decimals}) in lte`);
    }
    return this.int.lte(other.int);
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
    if (this.decimals !== other.decimals) {
      throw new Error(`decimals must match, got (${this.decimals}, ${other.decimals}) in add`);
    }
    return new GN(this.int.plus(other.int).toFixed(0), this.decimals);
  }

  sub(other: GN) {
    if (this.decimals !== other.decimals) {
      throw new Error(`decimals must match, got (${this.decimals}, ${other.decimals}) in sub`);
    }
    return new GN(this.int.minus(other.int).toFixed(0), this.decimals);
  }

  mul(other: GN) {
    return new GN(this.int.times(other.int).div(other.scaler).toFixed(0), this.decimals);
  }

  div(other: GN) {
    return new GN(this.int.times(other.scaler).div(other.int).toFixed(0), this.decimals);
  }

  sqrt() {
    return GN.fromDecimalBig(this.x().sqrt(), this.decimals);
  }

  recklessMul(other: BigSource) {
    other = new Big(other);
    if (!isInteger(other)) {
      console.warn(`recklessMul by non-integer (${other.toString()}) wouldn't be possible in the EVM. Be careful!`);
    }
    return new GN(this.int.times(other).toFixed(0), this.decimals);
  }

  recklessDiv(other: BigSource) {
    other = new Big(other);
    if (!isInteger(other)) {
      console.warn(`recklessMul by non-integer (${other.toString()}) wouldn't be possible in the EVM. Be careful!`);
    }
    return new GN(this.int.div(other).toFixed(0), this.decimals);
  }

  /*//////////////////////////////////////////////////////////////
                              CONVERSION
  //////////////////////////////////////////////////////////////*/

  toString(format: GNFormat) {
    switch (format) {
      case GNFormat.LOSSLESS_INT:
        return this.int.toFixed(0);
      case GNFormat.LOSSLESS_DECIMAL:
        return this.x().toFixed(this.decimals);
      case GNFormat.LOSSY_HUMAN:
        // TODO: Bring logic in here instead of calling formatTokenAmount
        return formatTokenAmount(this.x().toNumber());
      case GNFormat.LOSSY_HUMAN_COMPACT:
        // TODO: Bring logic in here instead of calling formatTokenAmountCompact
        return formatTokenAmountCompact(this.x().toNumber());
    }
  }

  /**
   * Converts to `BigNumber` without loss of precision.
   * @returns Equivalent `BigNumber`
   */
  toBigNumber() {
    return BigNumber.from(this.toString(GNFormat.LOSSLESS_INT));
  }

  /**
   * Converts to `JSBI.BigInt` without loss of precision.
   * @returns Equivalent `JSBI.BigInt`
   */
  toJSBI() {
    return JSBI.BigInt(this.toString(GNFormat.LOSSLESS_INT));
  }

  /**
   * Converts a fixed-point integer (stored as a BigNumber) to a `GN`
   * @param int The fixed-point integer as a BigNumber
   * @param decimals The power of 10 used to compute the fixed-point scaling factor
   * @returns Equivalent `GN`
   *
   * @example
   * ```
   * const bn = await erc20.balanceOf(userAddress);
   * const decimals = await erc20.decimals();
   * const gn = GN.fromBigNumber(bn, decimals)
   * ```
   */
  static fromBigNumber(int: BigNumber, decimals: number) {
    return new GN(int.toString(), decimals);
  }

  /**
   * Converts a fixed-point integer (stored as a BigInt) to a `GN`
   * @param int The fixed-point integer as a JSBI.BigInt
   * @param decimals The power of 10 used to compute the fixed-point scaling factor
   * @returns Equivalent `GN`
   *
   * @example
   * ```
   * const amount = GN.fromJSBI(JSBI.BigInt('1000001'), 6);
   * amount.toString(GNFormat.LOSSLESS_DECIMAL); // 1.000001
   * ```
   */
  static fromJSBI(int: JSBI, decimals: number) {
    return new GN(int.toString(10), decimals);
  }

  /**
   * Converts a decimal number (stored as a Big) to a `GN`
   * @param x The decimal number as a Big. Decimal places beyond `decimals` will be cut off.
   * @param decimals The number's precision, i.e. the number of decimal places that should be printed
   * when expressing the number in standard notation.
   * @returns Equivalent `GN`
   */
  static fromDecimalBig(x: Big, decimals: number) {
    return new GN(x.mul(scalerFor(decimals)).toFixed(0), decimals);
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
}
