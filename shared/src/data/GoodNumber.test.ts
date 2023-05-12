import { BigNumber } from 'ethers';
import JSBI from 'jsbi';
import { Big } from 'big.js';
import { GN, GNFormat, scalerFor } from './GoodNumber';

describe('GoodNumber', () => {
  describe('scaleFor', () => {
    it('should return a scaler string for base 2 with resolution divisible by 4', () => {
      expect(scalerFor(2, 4)).toEqual('16');
      expect(scalerFor(2, 8)).toEqual('256');
      expect(scalerFor(2, 12)).toEqual('4096');
    });
    it('should throw an error for base 2 with resolution not divisible by 4', () => {
      expect(() => scalerFor(2, 3)).toThrow('Q number resolution must be a multiple of 4');
      expect(() => scalerFor(2, 5)).toThrow('Q number resolution must be a multiple of 4');
      expect(() => scalerFor(2, 7)).toThrow('Q number resolution must be a multiple of 4');
    });
    it('should return a scaler string for base 10', () => {
      expect(scalerFor(10, 2)).toEqual('100');
      expect(scalerFor(10, 3)).toEqual('1000');
      expect(scalerFor(10, 4)).toEqual('10000');
    });
  });

  describe('cmp', () => {
    it('should return 0 for equal values', () => {
      expect(GN.fromDecimalString('1', 18).cmp(GN.fromDecimalString('1', 18))).toBe(0);
    });
    it('should return 1 for greater values', () => {
      expect(GN.fromDecimalString('2', 18).cmp(GN.fromDecimalString('1', 18))).toBe(1);
    });
    it('should return -1 for lesser values', () => {
      expect(GN.fromDecimalString('1', 18).cmp(GN.fromDecimalString('2', 18))).toBe(-1);
    });
    it('should throw an error if scalers do not match', () => {
      expect(() => GN.fromDecimalString('1', 18).cmp(GN.fromDecimalString('1', 19))).toThrow();
    });
  });

  describe('eq', () => {
    it('should return true for equal values', () => {
      expect(GN.fromDecimalString('1', 18).eq(GN.fromDecimalString('1', 18))).toBe(true);
    });
    it('should return false for unequal values', () => {
      expect(GN.fromDecimalString('2', 18).eq(GN.fromDecimalString('1', 18))).toBe(false);
    });
    it('should throw an error if scalers do not match', () => {
      expect(() => GN.fromDecimalString('1', 18).eq(GN.fromDecimalString('1', 19))).toThrow();
    });
  });

  describe('gt', () => {
    it('should return true for greater values', () => {
      expect(GN.fromDecimalString('2', 18).gt(GN.fromDecimalString('1', 18))).toBe(true);
    });
    it('should return false for lesser values', () => {
      expect(GN.fromDecimalString('1', 18).gt(GN.fromDecimalString('2', 18))).toBe(false);
    });
    it('should return false for equal values', () => {
      expect(GN.fromDecimalString('1', 18).gt(GN.fromDecimalString('1', 18))).toBe(false);
    });
    it('should throw an error if scalers do not match', () => {
      expect(() => GN.fromDecimalString('1', 18).gt(GN.fromDecimalString('1', 19))).toThrow();
    });
  });

  describe('gte', () => {
    it('should return true for greater values', () => {
      expect(GN.fromDecimalString('2', 18).gte(GN.fromDecimalString('1', 18))).toBe(true);
    });
    it('should return false for lesser values', () => {
      expect(GN.fromDecimalString('1', 18).gte(GN.fromDecimalString('2', 18))).toBe(false);
    });
    it('should return true for equal values', () => {
      expect(GN.fromDecimalString('1', 18).gte(GN.fromDecimalString('1', 18))).toBe(true);
    });
    it('should throw an error if scalers do not match', () => {
      expect(() => GN.fromDecimalString('1', 18).gte(GN.fromDecimalString('1', 19))).toThrow();
    });
  });

  describe('lt', () => {
    it('should return true for lesser values', () => {
      expect(GN.fromDecimalString('1', 18).lt(GN.fromDecimalString('2', 18))).toBe(true);
    });
    it('should return false for greater values', () => {
      expect(GN.fromDecimalString('2', 18).lt(GN.fromDecimalString('1', 18))).toBe(false);
    });
    it('should return false for equal values', () => {
      expect(GN.fromDecimalString('1', 18).lt(GN.fromDecimalString('1', 18))).toBe(false);
    });
    it('should throw an error if scalers do not match', () => {
      expect(() => GN.fromDecimalString('1', 18).lt(GN.fromDecimalString('1', 19))).toThrow();
    });
  });

  describe('lte', () => {
    it('should return true for lesser values', () => {
      expect(GN.fromDecimalString('1', 18).lte(GN.fromDecimalString('2', 18))).toBe(true);
    });
    it('should return false for greater values', () => {
      expect(GN.fromDecimalString('2', 18).lte(GN.fromDecimalString('1', 18))).toBe(false);
    });
    it('should return true for equal values', () => {
      expect(GN.fromDecimalString('1', 18).lte(GN.fromDecimalString('1', 18))).toBe(true);
    });
    it('should throw an error if scalers do not match', () => {
      expect(() => GN.fromDecimalString('1', 18).lte(GN.fromDecimalString('1', 19))).toThrow();
    });
  });

  describe('isZero', () => {
    it('should return true for 0', () => {
      expect(GN.fromDecimalString('0', 18).isZero()).toBe(true);
    });
    it('should return false for non-zero values', () => {
      expect(GN.fromDecimalString('1', 18).isZero()).toBe(false);
      expect(GN.fromDecimalString('0.000000000000000001', 18).isZero()).toBe(false);
    });
  });

  describe('isGtZero', () => {
    it('should return false for 0', () => {
      expect(GN.fromDecimalString('0', 18).isGtZero()).toBe(false);
    });
    it('should return false for negative values', () => {
      expect(GN.fromDecimalString('-1', 18).isGtZero()).toBe(false);
      expect(GN.fromDecimalString('-0.000000000000000001', 18).isGtZero()).toBe(false);
    });
    it('should return true for non-zero values', () => {
      expect(GN.fromDecimalString('1', 18).isGtZero()).toBe(true);
      expect(GN.fromDecimalString('0.000000000000000001', 18).isGtZero()).toBe(true);
    });
  });

  describe('isGteZero', () => {
    it('should return true for 0', () => {
      expect(GN.fromDecimalString('0', 18).isGteZero()).toBe(true);
    });
    it('should return true for non-zero values', () => {
      expect(GN.fromDecimalString('1', 18).isGteZero()).toBe(true);
      expect(GN.fromDecimalString('0.000000000000000001', 18).isGteZero()).toBe(true);
    });
    it('should return false for negative values', () => {
      expect(GN.fromDecimalString('-1', 18).isGteZero()).toBe(false);
      expect(GN.fromDecimalString('-0.000000000000000001', 18).isGteZero()).toBe(false);
    });
  });

  describe('isLtZero', () => {
    it('should return false for 0', () => {
      expect(GN.fromDecimalString('0', 18).isLtZero()).toBe(false);
    });
    it('should return false for non-zero values', () => {
      expect(GN.fromDecimalString('1', 18).isLtZero()).toBe(false);
      expect(GN.fromDecimalString('0.000000000000000001', 18).isLtZero()).toBe(false);
    });
    it('should return true for negative values', () => {
      expect(GN.fromDecimalString('-1', 18).isLtZero()).toBe(true);
      expect(GN.fromDecimalString('-0.000000000000000001', 18).isLtZero()).toBe(true);
    });
  });

  describe('isLteZero', () => {
    it('should return true for 0', () => {
      expect(GN.fromDecimalString('0', 18).isLteZero()).toBe(true);
    });
    it('should return false for non-zero values', () => {
      expect(GN.fromDecimalString('1', 18).isLteZero()).toBe(false);
      expect(GN.fromDecimalString('0.000000000000000001', 18).isLteZero()).toBe(false);
    });
    it('should return true for negative values', () => {
      expect(GN.fromDecimalString('-1', 18).isLteZero()).toBe(true);
      expect(GN.fromDecimalString('-0.000000000000000001', 18).isLteZero()).toBe(true);
    });
  });

  describe('max', () => {
    it('should return the larger of two values', () => {
      const a = GN.fromDecimalString('1', 18);
      const b = GN.fromDecimalString('2', 18);
      expect(GN.max(a, b)).toEqual(b);
      expect(GN.max(b, a)).toEqual(b);
    });
  });

  describe('min', () => {
    it('should return the smaller of two values', () => {
      const a = GN.fromDecimalString('1', 18);
      const b = GN.fromDecimalString('2', 18);
      expect(GN.min(a, b)).toEqual(a);
      expect(GN.min(b, a)).toEqual(a);
    });
  });

  describe('areWithinNSigDigs', () => {
    it('should return true if two values are within N significant digits', () => {
      const a = GN.fromDecimalString('1', 18);
      const b = GN.fromDecimalString('1.000000000000000001', 18);
      expect(GN.firstNSigDigsMatch(a, b, 18)).toBe(true);
      const c = GN.fromDecimalString('1.0235', 18);
      const d = GN.fromDecimalString('1.02', 18);
      expect(GN.firstNSigDigsMatch(c, d, 3)).toBe(true);
    });
    it('should return false if two values are not within N significant digits', () => {
      const a = GN.fromDecimalString('1', 18);
      const b = GN.fromDecimalString('1.000000000000000001', 18);
      expect(GN.firstNSigDigsMatch(a, b, 19)).toBe(false);
      const c = GN.fromDecimalString('1.0235', 18);
      const d = GN.fromDecimalString('1.02', 18);
      expect(GN.firstNSigDigsMatch(c, d, 4)).toBe(false);
    });
  });

  describe('add', () => {
    it('should add two values', () => {
      expect(GN.fromDecimalString('1', 18).add(GN.fromDecimalString('2', 18)).toString(GNFormat.DECIMAL)).toEqual('3');
    });
    it('should throw an error if scalers do not match', () => {
      expect(() => GN.fromDecimalString('1', 18).add(GN.fromDecimalString('1', 19))).toThrow();
    });
  });

  describe('sub', () => {
    it('should subtract two values', () => {
      expect(GN.fromDecimalString('2', 18).sub(GN.fromDecimalString('1', 18)).toString(GNFormat.DECIMAL)).toEqual('1');
    });
    it('should throw an error if scalers do not match', () => {
      expect(() => GN.fromDecimalString('1', 18).sub(GN.fromDecimalString('1', 19))).toThrow();
    });
  });

  describe('mul', () => {
    it('should multiply two values', () => {
      expect(GN.fromDecimalString('2', 18).mul(GN.fromDecimalString('2', 18)).toString(GNFormat.DECIMAL)).toEqual('4');
    });
  });

  describe('div', () => {
    it('should divide two values', () => {
      expect(GN.fromDecimalString('2', 18).div(GN.fromDecimalString('2', 18)).toString(GNFormat.DECIMAL)).toEqual('1');
    });
  });

  describe('sqrt', () => {
    it('should return the square root of a value', () => {
      expect(GN.fromDecimalString('4', 18).sqrt().toString(GNFormat.DECIMAL)).toEqual('2');
    });
  });

  describe('square', () => {
    it('should return the square of a value', () => {
      expect(GN.fromDecimalString('2', 18).square().toString(GNFormat.DECIMAL)).toEqual('4');
    });
  });

  describe('recklessMul', () => {
    it('should multiply two values', () => {
      expect(GN.fromDecimalString('2', 18).recklessMul(2).toString(GNFormat.DECIMAL)).toEqual('4');
    });
    it('should print a warning if the input is not an integer', () => {
      const spy = jest.spyOn(console, 'warn');
      GN.fromDecimalString('2', 18).recklessMul(2.1);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('recklessDiv', () => {
    it('should divide two values', () => {
      expect(GN.fromDecimalString('2', 18).recklessDiv(2).toString(GNFormat.DECIMAL)).toEqual('1');
    });
    it('should print a warning if the input is not an integer', () => {
      const spy = jest.spyOn(console, 'warn');
      GN.fromDecimalString('2', 18).recklessDiv(2.1);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('recklessAdd', () => {
    it('should add two values', () => {
      expect(
        GN.fromDecimalString('1', 18)
          .recklessAdd(2 * 10 ** 18)
          .toString(GNFormat.DECIMAL)
      ).toEqual('3');
    });
    it('should print a warning if the input is not an integer', () => {
      const spy = jest.spyOn(console, 'warn');
      GN.fromDecimalString('2', 18).recklessAdd(0.1);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('recklessSub', () => {
    it('should subtract two values', () => {
      expect(
        GN.fromDecimalString('2', 18)
          .recklessSub(10 ** 18)
          .toString(GNFormat.DECIMAL)
      ).toEqual('1');
    });
    it('should print a warning if the input is not an integer', () => {
      const spy = jest.spyOn(console, 'warn');
      GN.fromDecimalString('2', 18).recklessSub(0.1);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('toString', () => {
    it('should return a decimal string', () => {
      expect(GN.fromDecimalString('1', 18).toString(GNFormat.DECIMAL)).toEqual('1');
    });
    it('should return trailing zeros', () => {
      expect(GN.fromDecimalString('1', 18).toString(GNFormat.DECIMAL_WITH_TRAILING_ZEROS)).toEqual(
        '1.000000000000000000'
      );
    });
    it('should return a fixed string integer', () => {
      expect(GN.fromDecimalString('1', 18).toString(GNFormat.INT)).toEqual('1000000000000000000');
    });
    it('should return a human readable string', () => {
      expect(GN.fromDecimalString('1', 18).toString(GNFormat.LOSSY_HUMAN)).toEqual('1.0');
      expect(GN.fromDecimalString('1000', 18).toString(GNFormat.LOSSY_HUMAN)).toEqual('1,000');
      expect(GN.fromDecimalString('1000000', 18).toString(GNFormat.LOSSY_HUMAN)).toEqual('1,000,000');
      expect(GN.fromDecimalString('0.00203982', 18).toString(GNFormat.LOSSY_HUMAN)).toEqual('0.00204');
      expect(GN.fromDecimalString('0.000000000000000001', 18).toString(GNFormat.LOSSY_HUMAN)).toEqual('1.0E-18');
    });
    it('should return a compact human readable string', () => {
      expect(GN.fromDecimalString('1', 18).toString(GNFormat.LOSSY_HUMAN_COMPACT)).toEqual('1.0');
      expect(GN.fromDecimalString('1000', 18).toString(GNFormat.LOSSY_HUMAN_COMPACT)).toEqual('1,000');
      expect(GN.fromDecimalString('1000000', 18).toString(GNFormat.LOSSY_HUMAN_COMPACT)).toEqual('1,000,000');
      expect(GN.fromDecimalString('1000000000', 18).toString(GNFormat.LOSSY_HUMAN_COMPACT)).toEqual('1.0B');
      expect(GN.fromDecimalString('1000000000000', 18).toString(GNFormat.LOSSY_HUMAN_COMPACT)).toEqual('1.0T');
      expect(GN.fromDecimalString('1000000000000000', 18).toString(GNFormat.LOSSY_HUMAN_COMPACT)).toEqual('1000T');
      expect(GN.fromDecimalString('0.00203982', 18).toString(GNFormat.LOSSY_HUMAN_COMPACT)).toEqual('2.04E-3');
      expect(GN.fromDecimalString('0.000000000000000001', 18).toString(GNFormat.LOSSY_HUMAN_COMPACT)).toEqual('1E-18');
    });
  });

  describe('toBigNumber', () => {
    it('should return an equivalent BigNumber', () => {
      expect(GN.fromDecimalString('1', 18).toBigNumber()).toEqual(BigNumber.from('1000000000000000000'));
    });
  });

  describe('toJSBI', () => {
    it('should return an equivalent JSBI', () => {
      expect(GN.fromDecimalString('1', 18).toJSBI()).toEqual(JSBI.BigInt('1000000000000000000'));
    });
  });

  describe('toNumber', () => {
    it('should return an equivalent number', () => {
      expect(GN.fromDecimalString('0.0000001', 18).toNumber()).toEqual(0.0000001);
    });
  });

  describe('setResolution', () => {
    it('should set the resolution', () => {
      expect(GN.fromDecimalString('1', 18).setResolution(9).toString(GNFormat.DECIMAL)).toEqual('1000000000');
      expect(GN.fromDecimalString('1', 18).setResolution(4).toString(GNFormat.DECIMAL)).toEqual('100000000000000');
      expect(GN.fromDecimalString('1', 18).setResolution(19).toString(GNFormat.DECIMAL)).toEqual('0.1');
    });
  });

  describe('zero', () => {
    it('should return a zero value', () => {
      expect(GN.zero(18).toString(GNFormat.DECIMAL)).toEqual('0');
    });
  });

  describe('one', () => {
    it('should return a one value', () => {
      expect(GN.one(18).toString(GNFormat.DECIMAL)).toEqual('1');
      expect(GN.one(18).toString(GNFormat.INT)).toEqual('1000000000000000000');
    });
  });

  describe('Q', () => {
    it('should return a value of 2^N', () => {
      expect(GN.Q(4).toString(GNFormat.INT)).toEqual('16');
      expect(GN.Q(8).toString(GNFormat.INT)).toEqual('256');
      expect(GN.Q(12).toString(GNFormat.INT)).toEqual('4096');
      expect(GN.Q(16).toString(GNFormat.INT)).toEqual('65536');
      expect(GN.Q(96).toString(GNFormat.INT)).toEqual('79228162514264337593543950336');
    });
    it('should throw an error if N is not a multiple of 4', () => {
      expect(() => GN.Q(1)).toThrow();
      expect(() => GN.Q(2)).toThrow();
      expect(() => GN.Q(3)).toThrow();
      expect(() => GN.Q(97)).toThrow();
    });
  });

  describe('fromDecimalBig', () => {
    it('should return a decimal string', () => {
      expect(GN.fromDecimalBig(new Big('1'), 18).toString(GNFormat.DECIMAL)).toEqual('1');
    });
  });

  describe('fromBigNumber', () => {
    it('should return a decimal string', () => {
      expect(GN.fromBigNumber(BigNumber.from('1000000000000000000'), 18).toString(GNFormat.DECIMAL)).toEqual('1');
    });
  });

  describe('fromJSBI', () => {
    it('should return a decimal string', () => {
      expect(GN.fromJSBI(JSBI.BigInt('1000000000000000000'), 18).toString(GNFormat.DECIMAL)).toEqual('1');
    });
  });

  describe('fromDecimalString', () => {
    it('should return a decimal string', () => {
      expect(GN.fromDecimalString('1', 18).toString(GNFormat.DECIMAL)).toEqual('1');
    });
    it('should throw an error if the value is not a number', () => {
      expect(() => GN.fromDecimalString('a', 18)).toThrow();
    });
  });

  describe('fromNumber', () => {
    it('should return a decimal string', () => {
      expect(GN.fromNumber(1, 18).toString(GNFormat.DECIMAL)).toEqual('1');
    });
    it('should print a warning since it is deprecated', () => {
      const spy = jest.spyOn(console, 'warn');
      GN.fromNumber(1, 18);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
