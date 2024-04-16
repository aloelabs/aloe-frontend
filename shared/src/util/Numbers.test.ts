import Big from 'big.js';
import {
  areWithinNSigDigs,
  roundDownToNearestN,
  roundUpToNearestN,
  getDecimalPlaces,
  truncateDecimals,
  roundPercentage,
  formatAmountWithUnit,
  formatUSD,
  formatUSDCompact,
  formatUSDAuto,
  formatNumberInput,
  formatTokenAmount,
  formatTokenAmountCompact,
  prettyFormatBalance,
  toBig,
  String1E,
} from './Numbers';
import { BigNumber } from 'ethers';

describe('Numbers', () => {
  describe('areWithinNSigDigs', () => {
    it('should return true if the numbers are equal', () => {
      const a = new Big(1);
      const b = new Big(1);
      expect(areWithinNSigDigs(a, b, 1)).toBe(true);
      expect(areWithinNSigDigs(a, b, 5)).toBe(true);
    });
    it('should return true if the numbers are within the specified number of significant digits', () => {
      const a = new Big(1);
      const b = new Big(1.1);
      expect(areWithinNSigDigs(a, b, 1)).toBe(true);
      const c = new Big(0.001);
      const d = new Big(0.00101);
      expect(areWithinNSigDigs(c, d, 2)).toBe(true);
      const e = new Big(0.001);
      const f = new Big(0.0010001);
      expect(areWithinNSigDigs(e, f, 4)).toBe(true);
      expect(areWithinNSigDigs(e, f, 2)).toBe(true);
    });
    it('should return false if the numbers are not within the specified number of significant digits', () => {
      const a = new Big(1);
      const b = new Big(1.1);
      expect(areWithinNSigDigs(a, b, 2)).toBe(false);
      const c = new Big(0.001);
      const d = new Big(0.00101);
      expect(areWithinNSigDigs(c, d, 3)).toBe(false);
      const e = new Big(0.001);
      const f = new Big(0.0010001);
      expect(areWithinNSigDigs(e, f, 5)).toBe(false);
    });
  });

  describe('roundDownToNearestN', () => {
    it('should round down to the nearest N', () => {
      expect(roundDownToNearestN(1, 1)).toEqual(1);
      expect(roundDownToNearestN(1.1, 1)).toEqual(1);
      expect(roundDownToNearestN(1.9, 1)).toEqual(1);
      expect(roundDownToNearestN(1.1, 0.1)).toEqual(1.1);
      expect(roundDownToNearestN(125, 10)).toEqual(120);
      expect(roundDownToNearestN(125, 100)).toEqual(100);
    });
  });

  describe('roundUpToNearestN', () => {
    it('should round up to the nearest N', () => {
      expect(roundUpToNearestN(1, 1)).toEqual(1);
      expect(roundUpToNearestN(1.1, 1)).toEqual(2);
      expect(roundUpToNearestN(1.9, 1)).toEqual(2);
      expect(roundUpToNearestN(1.1, 0.1)).toEqual(1.1);
      expect(roundUpToNearestN(125, 10)).toEqual(130);
      expect(roundUpToNearestN(125, 100)).toEqual(200);
    });
  });

  describe('getDecimalPlaces', () => {
    it('should return the number of decimal places', () => {
      expect(getDecimalPlaces('1')).toEqual(0);
      expect(getDecimalPlaces('2502')).toEqual(0);
      expect(getDecimalPlaces('1.0')).toEqual(1);
      expect(getDecimalPlaces('1.02')).toEqual(2);
      expect(getDecimalPlaces('1.000')).toEqual(3);
      expect(getDecimalPlaces('1.000000')).toEqual(6);
      expect(getDecimalPlaces('1.00000000000000')).toEqual(14);
    });
  });

  describe('truncateDecimals', () => {
    it('should remove the decimal point if the number of decimal places is 0', () => {
      expect(truncateDecimals('1.1', 0)).toEqual('1');
    });
    it('should truncate the number of decimal places', () => {
      expect(truncateDecimals('1', 0)).toEqual('1');
      expect(truncateDecimals('1.02', 1)).toEqual('1.0');
      expect(truncateDecimals('1.52342', 3)).toEqual('1.523');
      expect(truncateDecimals('5234.52592305429235', 6)).toEqual('5234.525923');
    });
  });

  describe('roundPercentage', () => {
    it('should round the percentage to the nearest 0.01', () => {
      expect(roundPercentage(10)).toEqual(10);
      expect(roundPercentage(10.1)).toEqual(10.1);
      expect(roundPercentage(10.01)).toEqual(10.01);
      expect(roundPercentage(10.001)).toEqual(10);
      expect(roundPercentage(92.255)).toEqual(92.26);
      expect(roundPercentage(100.0)).toEqual(100);
    });
    it('should round the percentage with the specified precision', () => {
      expect(roundPercentage(10, 1)).toEqual(10);
      expect(roundPercentage(10.1, 1)).toEqual(10.1);
      expect(roundPercentage(10.01, 1)).toEqual(10);
      expect(roundPercentage(92.255, 3)).toEqual(92.255);
      expect(roundPercentage(100.0, 3)).toEqual(100);
    });
  });

  describe('formatAmountWithUnit', () => {
    it('should format the amount with the unit', () => {
      expect(formatAmountWithUnit(1, 'ETH')).toEqual('1 ETH');
      expect(formatAmountWithUnit(1.1, 'ETH')).toEqual('1.1 ETH');
      expect(formatAmountWithUnit(952932.252, 'WETH')).toEqual('952.9K WETH');
    });
  });

  describe('formatUSD', () => {
    it('should format $0.00 correctly', () => {
      expect(formatUSD(0)).toEqual('$0.00');
    });
    it('should format the amount in USD', () => {
      expect(formatUSD(1)).toEqual('$1.00');
      expect(formatUSD(1.1)).toEqual('$1.10');
      expect(formatUSD(125.25)).toEqual('$125.25');
      expect(formatUSD(1592.25)).toEqual('$1,592.25');
      expect(formatUSD(15922.252)).toEqual('$15,922.25');
      expect(formatUSD(952932.252)).toEqual('$952,932.25');
      expect(formatUSD(1000000)).toEqual('$1,000,000.00');
      expect(formatUSD(1000000000)).toEqual('$1,000,000,000.00');
      expect(formatUSD(1000000000.99)).toEqual('$1,000,000,000.99');
    });
    it('should display the specified placeholder if the amount is null', () => {
      expect(formatUSD(null)).toEqual('-');
      expect(formatUSD(null, 'test')).toEqual('test');
    });
  });

  describe('formatUSDCompact', () => {
    it('should format the amount in USD', () => {
      expect(formatUSDCompact(1)).toEqual('$1');
      expect(formatUSDCompact(1.1)).toEqual('$1.1');
      expect(formatUSDCompact(152.252)).toEqual('$152');
      expect(formatUSDCompact(1592.25)).toEqual('$1.59K');
      expect(formatUSDCompact(15921.25)).toEqual('$15.9K');
      expect(formatUSDCompact(952932.252)).toEqual('$953K');
      expect(formatUSDCompact(1000000)).toEqual('$1M');
      expect(formatUSDCompact(1225209)).toEqual('$1.23M');
      expect(formatUSDCompact(1000000000)).toEqual('$1B');
      expect(formatUSDCompact(1252923409)).toEqual('$1.25B');
    });
    it('should display the specified placeholder if the amount is null', () => {
      expect(formatUSDCompact(null)).toEqual('-');
      expect(formatUSDCompact(null, 'test')).toEqual('test');
    });
  });

  describe('formatUSDAuto', () => {
    it('should format the amount in USD', () => {
      expect(formatUSDAuto(1)).toEqual('$1.00');
      expect(formatUSDAuto(1.1)).toEqual('$1.10');
      expect(formatUSDAuto(125.25)).toEqual('$125.25');
      expect(formatUSDAuto(1592.25)).toEqual('$1.59K');
      expect(formatUSDAuto(15922.252)).toEqual('$15.9K');
      expect(formatUSDAuto(952932.252)).toEqual('$953K');
      expect(formatUSDAuto(1000000)).toEqual('$1M');
      expect(formatUSDAuto(1225209)).toEqual('$1.23M');
      expect(formatUSDAuto(1000000000)).toEqual('$1B');
      expect(formatUSDAuto(1252923409)).toEqual('$1.25B');
    });
    it('should display the specified placeholder if the amount is null', () => {
      expect(formatUSDAuto(null)).toEqual('-');
      expect(formatUSDAuto(null, 'test')).toEqual('test');
    });
  });

  describe('formatNumberInput', () => {
    it('should format the number input for positive numbers', () => {
      expect(formatNumberInput('')).toEqual('');
      expect(formatNumberInput('-')).toEqual('');
      expect(formatNumberInput('.')).toEqual('0.');
      expect(formatNumberInput('1')).toEqual('1');
      expect(formatNumberInput('1.')).toEqual('1.');
      expect(formatNumberInput('1.1')).toEqual('1.1');
    });
    it('should format the number input for negative numbers', () => {
      expect(formatNumberInput('', true)).toEqual('');
      expect(formatNumberInput('-', true)).toEqual('');
      expect(formatNumberInput('.', true)).toEqual('-0.');
      expect(formatNumberInput('1', true)).toEqual('-1');
      expect(formatNumberInput('1.', true)).toEqual('-1.');
      expect(formatNumberInput('1.1', true)).toEqual('-1.1');
    });
    it('should format the number input using the specified decimals', () => {
      expect(formatNumberInput('1', false, 1)).toEqual('1');
      expect(formatNumberInput('1.', false, 1)).toEqual('1.');
      expect(formatNumberInput('1.1', false, 1)).toEqual('1.1');
      expect(formatNumberInput('1.1', false, 2)).toEqual('1.1');
      expect(formatNumberInput('1.1', true, 1)).toEqual('-1.1');
      expect(formatNumberInput('', false, 1)).toEqual('');
      expect(formatNumberInput('-', false, 1)).toEqual('');
      expect(formatNumberInput('.', false, 1)).toEqual('0.');
      expect(formatNumberInput('', true, 1)).toEqual('');
      expect(formatNumberInput('-', true, 1)).toEqual('');
      expect(formatNumberInput('.', true, 1)).toEqual('-0.');
    });
    it('should return null if the input is invalid', () => {
      expect(formatNumberInput('a')).toEqual(null);
      expect(formatNumberInput('a', true)).toEqual(null);
      expect(formatNumberInput('1a')).toEqual(null);
      expect(formatNumberInput('1a', true)).toEqual(null);
      expect(formatNumberInput('1.a')).toEqual(null);
      expect(formatNumberInput('1.a', true)).toEqual(null);
      expect(formatNumberInput('1.1a')).toEqual(null);
      expect(formatNumberInput('1.1a', true)).toEqual(null);
      expect(formatNumberInput('1.1.1')).toEqual(null);
      expect(formatNumberInput('1.1.1', true)).toEqual(null);
    });
  });

  describe('formatTokenAmount', () => {
    it('should format zero', () => {
      expect(formatTokenAmount(0)).toEqual('0.0');
    });
    it('should format very small amounts', () => {
      expect(formatTokenAmount(0.00000000000192542)).toEqual('1.9E-12');
      expect(formatTokenAmount(0.000000000001967)).toEqual('2.0E-12');
      expect(formatTokenAmount(0.0000000000000000052529)).toEqual('5.3E-18');
    });
    it('should format small amounts', () => {
      expect(formatTokenAmount(0.00005)).toEqual('0.000050');
      expect(formatTokenAmount(0.00052)).toEqual('0.00052');
      expect(formatTokenAmount(0.000525)).toEqual('0.000525');
      expect(formatTokenAmount(0.0005252)).toEqual('0.0005252');
      expect(formatTokenAmount(0.00052525)).toEqual('0.0005253');
    });
    it('should format amounts', () => {
      expect(formatTokenAmount(0.005)).toEqual('0.0050');
      expect(formatTokenAmount(0.052)).toEqual('0.052');
      expect(formatTokenAmount(0.052542)).toEqual('0.05254');
      expect(formatTokenAmount(1)).toEqual('1.0');
      expect(formatTokenAmount(1.1)).toEqual('1.1');
      expect(formatTokenAmount(1.123)).toEqual('1.123');
      expect(formatTokenAmount(1.1234)).toEqual('1.123');
      expect(formatTokenAmount(15.252)).toEqual('15.25');
      expect(formatTokenAmount(235.923)).toEqual('235.9');
      expect(formatTokenAmount(9529.252)).toEqual('9,529');
    });
    it('should format large amounts', () => {
      expect(formatTokenAmount(15929.2542)).toEqual('15,929');
      expect(formatTokenAmount(573252.8232)).toEqual('573,253');
      expect(formatTokenAmount(2529253.7529)).toEqual('2.529M');
    });
    it('should format very large amounts', () => {
      expect(formatTokenAmount(1000000000)).toEqual('1.0B');
      expect(formatTokenAmount(1252923409)).toEqual('1.253B');
      expect(formatTokenAmount(1000000000000)).toEqual('1.0T');
      expect(formatTokenAmount(1252923409000)).toEqual('1.253T');
      expect(formatTokenAmount(10000000000000)).toEqual('10T');
      expect(formatTokenAmount(12529234090000)).toEqual('1.3e+13');
      expect(formatTokenAmount(159203242993439)).toEqual('1.6e+14');
      expect(formatTokenAmount(1000000000000000)).toEqual('1.0e+15');
      expect(formatTokenAmount(1252923409000000)).toEqual('1.3e+15');
      expect(formatTokenAmount(1e18)).toEqual('1.0e+18');
      expect(formatTokenAmount(2.252e18)).toEqual('2.3e+18');
      expect(formatTokenAmount(1e21)).toEqual('1.0e+21');
      expect(formatTokenAmount(5.252e21)).toEqual('5.3e+21');
    });
  });

  describe('formatTokenAmountCompact', () => {
    it('should format zero', () => {
      expect(formatTokenAmountCompact(0)).toEqual('0.0');
    });
    it('should format very small amounts', () => {
      expect(formatTokenAmountCompact(0.00000000000192542)).toEqual('1.93E-12');
      expect(formatTokenAmountCompact(0.000000000001967)).toEqual('1.97E-12');
      expect(formatTokenAmountCompact(0.0000000000000000052529)).toEqual('5.25E-18');
    });
    it('should format small amounts', () => {
      expect(formatTokenAmountCompact(0.00005)).toEqual('5E-5');
      expect(formatTokenAmountCompact(0.00052)).toEqual('5.2E-4');
      expect(formatTokenAmountCompact(0.000525)).toEqual('5.25E-4');
      expect(formatTokenAmountCompact(0.0005252)).toEqual('5.25E-4');
      expect(formatTokenAmountCompact(0.00052525)).toEqual('5.25E-4');
    });
    it('should format amounts', () => {
      expect(formatTokenAmountCompact(0.005)).toEqual('5E-3');
      expect(formatTokenAmountCompact(0.052)).toEqual('0.052');
      expect(formatTokenAmountCompact(0.052542)).toEqual('0.052542');
      expect(formatTokenAmountCompact(1)).toEqual('1.0');
      expect(formatTokenAmountCompact(1.1)).toEqual('1.1');
      expect(formatTokenAmountCompact(1.123)).toEqual('1.123');
      expect(formatTokenAmountCompact(1.1234)).toEqual('1.1234');
      expect(formatTokenAmountCompact(15.252)).toEqual('15.252');
      expect(formatTokenAmountCompact(235.923)).toEqual('235.92');
    });
    it('should format large amounts', () => {
      expect(formatTokenAmountCompact(15929.2542)).toEqual('15,929');
      expect(formatTokenAmountCompact(573252.8232)).toEqual('573,250');
      expect(formatTokenAmountCompact(2529253.7529)).toEqual('2.529M');
    });
    it('should format very large amounts', () => {
      expect(formatTokenAmountCompact(1000000000)).toEqual('1.0B');
      expect(formatTokenAmountCompact(1252923409)).toEqual('1.253B');
      expect(formatTokenAmountCompact(1000000000000)).toEqual('1.0T');
      expect(formatTokenAmountCompact(1252923409000)).toEqual('1.253T');
      expect(formatTokenAmountCompact(10000000000000)).toEqual('10T');
      expect(formatTokenAmountCompact(12529234090000)).toEqual('12.53T');
      expect(formatTokenAmountCompact(159203242993439)).toEqual('159.2T');
      expect(formatTokenAmountCompact(1000000000000000)).toEqual('1000T');
      expect(formatTokenAmountCompact(1252923409000000)).toEqual('1253T');
      expect(formatTokenAmountCompact(1e18)).toEqual('1,000,000T');
      expect(formatTokenAmountCompact(2.252e18)).toEqual('2,252,000T');
      expect(formatTokenAmountCompact(1e21)).toEqual('1,000,000,000T');
      expect(formatTokenAmountCompact(5.252e21)).toEqual('5,252,000,000T');
    });
  });

  describe('prettyFormatBalance', () => {
    it('should format a balance', () => {
      const balance0 = new Big('1000000000000000000');
      expect(prettyFormatBalance(balance0, 18)).toEqual('1.0000');
      const balance1 = new Big('2529253752925000000');
      expect(prettyFormatBalance(balance1, 18)).toEqual('2.5293');
      const balance2 = new Big('100000000000000');
      expect(prettyFormatBalance(balance2, 18)).toEqual('0.0001');
    });
    it('should not format if no balance is provided', () => {
      expect(prettyFormatBalance(undefined, 18)).toEqual('-');
    });
    it('should not format if no decimals are provided', () => {
      const balance = new Big('1000000000000000000');
      expect(prettyFormatBalance(balance, undefined)).toEqual('-');
    });
  });

  describe('toBig', () => {
    it('should convert a BigNumber to a Big', () => {
      const bn = BigNumber.from('852935923343242');
      const big = toBig(bn);
      expect(big).toBeInstanceOf(Big);
      expect(big.toString()).toEqual('852935923343242');
    });
  });

  describe('String1E', () => {
    it('should return 1 with the specified number of zeros after it', () => {
      expect(String1E(0)).toEqual('1');
      expect(String1E(1)).toEqual('10');
      expect(String1E(2)).toEqual('100');
      expect(String1E(3)).toEqual('1000');
      expect(String1E(4)).toEqual('10000');
      expect(String1E(5)).toEqual('100000');
      expect(String1E(8)).toEqual('100000000');
      expect(String1E(12)).toEqual('1000000000000');
      expect(String1E(15)).toEqual('1000000000000000');
      expect(String1E(18)).toEqual('1000000000000000000');
      expect(String1E(23)).toEqual('100000000000000000000000');
    });
  });
});
