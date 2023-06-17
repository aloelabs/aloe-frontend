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
} from './Numbers';

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
    it('should format the amount in USD', () => {
      expect(formatUSD(1)).toEqual('$1.00');
      expect(formatUSD(1.1)).toEqual('$1.10');
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
});
