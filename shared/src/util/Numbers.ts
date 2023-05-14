import Big from 'big.js';
import { ethers } from 'ethers';

const DEFAULT_PRECISION = 2;

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumSignificantDigits: 3,
});

export function toBig(value: ethers.BigNumber | ethers.utils.Result): Big {
  return new Big(value.toString());
}

/**
 * Converts a BigNumber (ethers type) to a standard Javascript number, but may lose precision in the decimal
 * places (because floats be like that)
 * @param value Source value in fixed point
 * @param decimals Number of decimals in the source
 * @returns Javascript number, approximately equal to `value`
 */
export function toImpreciseNumber(value: ethers.BigNumber | ethers.utils.Result, decimals: number): number {
  const big = toBig(value);
  return big.div(10 ** decimals).toNumber();
}

export function String1E(decimals: number): string {
  return `1${'0'.repeat(decimals)}`;
}

export function prettyFormatBalance(amount?: Big, decimals?: number): string {
  if (!amount || !decimals) {
    return '-';
  }
  return amount.div(String1E(decimals)).toFixed(decimals > 6 ? 4 : 2);
}

/**
 *
 * @param amount the amount of money in USD to format
 * @param placeholder the placeholder to use if the amount is null
 * @returns a formatted string representing the amount of money in USD
 */
export function formatUSD(amount: number | null, placeholder = '-'): string {
  if (amount === null) {
    return placeholder;
  }
  if (amount < 0.1) {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumSignificantDigits: 2,
      maximumSignificantDigits: 2,
    });
  }
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 *
 * @param amount the amount of money in USD to format
 * @param placeholder the placeholder to use if the amount is null
 * @returns a compact, formatted string representing the amount of money in USD
 */
export function formatUSDCompact(amount: number | null, placeholder = '-'): string {
  if (amount === null) {
    return placeholder;
  }
  return compactCurrencyFormatter.format(amount);
}

/**
 *
 * @param amount the amount of money in USD to format
 * @param placeholder the placeholder to use if the amount is null
 * @returns a formatted string representing the amount of money in USD using
 * either the compact or regular format depending on the amount
 */
export function formatUSDAuto(amount: number | null, placeholder = '-'): string {
  if (amount && amount < 1000) {
    return formatUSD(amount, placeholder);
  }
  return formatUSDCompact(amount, placeholder);
}

/**
 * @param percentage the percentage being rounded
 * @param precision the number of decimal places to round to
 * @returns the given percentage rounded to the given precision, without forcing a decimal point
 */
export function roundPercentage(percentage: number, precision?: number): number {
  precision = precision || DEFAULT_PRECISION;
  return Math.round((percentage + Number.EPSILON) * Math.pow(10, precision)) / Math.pow(10, precision);
}

//TODO: refactor this to handle edge cases better
export function formatNumberInput(input: string, negative?: boolean, maxDecimals?: number): string | null {
  if (input === '' || input === '-') {
    return '';
  } else if (input === '.') {
    return negative ? '-0.' : '0.';
  }
  const re = new RegExp(`^${negative ? '-?' : ''}[0-9\b]+[.\b]?[0-9\b]{0,}$`);

  if (re.test(input)) {
    // if (max && new Big(input).gt(new Big(max))) {
    //   return max;
    // }

    let result = input;
    if (negative && !input.startsWith('-')) {
      // If negative, add a negative sign if it isn't already there.
      result = `-${input}`;
    }

    return result;
  } else return null;
}

export function roundDownToNearestN(value: number, n: number): number {
  return Math.floor(value / n) * n;
}

export function roundUpToNearestN(value: number, n: number): number {
  return Math.ceil(value / n) * n;
}

export function formatTokenAmount(amount: number, sigDigs = 4): string {
  //TODO: if we want to support more than one locale, we would need to add more logic here
  if (amount > 1e6) {
    return amount.toLocaleString('en-US', {
      style: 'decimal',
      notation: 'compact',
      compactDisplay: 'short',
      maximumSignificantDigits: sigDigs,
      minimumSignificantDigits: Math.min(2, sigDigs),
    });
  } else if (amount > 1e-5 || amount === 0) {
    return amount.toLocaleString('en-US', {
      style: 'decimal',
      maximumSignificantDigits: sigDigs,
      minimumSignificantDigits: Math.min(2, sigDigs),
    });
  } else if (amount > 1e-10) {
    return amount.toLocaleString('en-US', {
      style: 'decimal',
      notation: 'scientific',
      maximumSignificantDigits: sigDigs,
      minimumSignificantDigits: Math.min(2, sigDigs),
    });
  } else {
    // If amount <= 10e-10, we want to show no more than 2 sigdigs
    return amount.toLocaleString('en-US', {
      style: 'decimal',
      notation: 'scientific',
      maximumSignificantDigits: 2,
      minimumSignificantDigits: 2,
    });
  }
}

export function formatTokenAmountCompact(amount: number, length = 4): string {
  if (amount >= 1e15) {
    return amount.toLocaleString('en-US', {
      style: 'decimal',
      notation: 'scientific',
      maximumSignificantDigits: length - 1,
    });
  } else if (amount > 1e6) {
    return amount.toLocaleString('en-US', {
      style: 'decimal',
      notation: 'compact',
      compactDisplay: 'short',
      maximumSignificantDigits: length,
      minimumSignificantDigits: 2,
    });
  } else if (amount > 10 ** -(length / 2) || amount === 0) {
    return amount.toLocaleString('en-US', {
      style: 'decimal',
      maximumSignificantDigits: length + 1,
      minimumSignificantDigits: 2,
    });
  } else {
    return amount.toLocaleString('en-US', {
      style: 'decimal',
      notation: 'scientific',
      maximumSignificantDigits: length - 1,
    });
  }
}

export function formatPriceRatio(x: number, sigDigs = 4): string {
  //TODO: if we want to support more than one locale, we would need to add more logic here
  if (x > 1e9) {
    return '∞';
  } else if (x > 1e6) {
    return x.toLocaleString('en-US', {
      style: 'decimal',
      notation: 'compact',
      compactDisplay: 'short',
      maximumSignificantDigits: sigDigs,
      minimumSignificantDigits: 2,
    });
  } else if (x > 1e-6) {
    return x.toLocaleString('en-US', {
      style: 'decimal',
      maximumSignificantDigits: sigDigs,
      minimumSignificantDigits: 2,
    });
  } else if (x > 1e-9) {
    return x.toLocaleString('en-US', {
      style: 'decimal',
      notation: 'engineering',
      maximumSignificantDigits: sigDigs,
    });
  } else {
    return '0';
  }
}

/**
 * Formats an amount with a unit, abbreviating large numbers and using scientific notation for small numbers.
 * Note: This function may not work properly if the unit close to or longer than the maximum length.
 * @param amount the amount to format
 * @param unit the unit to append to the amount
 * @param maxLength the maximum length of the formatted string
 * @returns the formatted string
 */
export function formatAmountWithUnit(amount: number, unit: string, maxLength = 10): string {
  const maxLengthOfAmount = maxLength - unit.length - 1;
  if (amount > 10_000) {
    // Abbreviate large numbers
    return `${amount.toLocaleString('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} ${unit}`;
  } else if (amount === 0) {
    return `0 ${unit}`;
  } else if (amount < Math.pow(10, -4)) {
    // Use scientific notation for small numbers
    return `${amount.toLocaleString('en-US', {
      notation: 'scientific',
      compactDisplay: 'short',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} ${unit}`;
  }
  // Otherwise, truncate decimals
  const numDigits = Math.max(Math.floor(Math.log10(Math.abs(amount))), 0);
  const numDecimals = Math.max(maxLengthOfAmount - numDigits, 0);
  return `${truncateDecimals(amount.toString(), numDecimals)} ${unit}`;
}

export function areWithinNSigDigs(a: Big, b: Big, n: number): boolean {
  return a.prec(n).eq(b.prec(n));
}

export function truncateDecimals(value: string, decimals: number): string {
  const decimalIndex = value.indexOf('.');
  if (decimalIndex === -1) {
    return value;
  }
  return value.slice(0, decimalIndex + decimals + 1);
}

export function getDecimalPlaces(value: string): number {
  const decimalIndex = value.indexOf('.');
  if (decimalIndex === -1) {
    return 0;
  }
  return value.length - decimalIndex - 1;
}
