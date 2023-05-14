import { formatTokenAmount } from './FormatNumber';

describe('FormatNumber', () => {
  describe('formatTokenAmount', () => {
    it('should format 0', () => {
      expect(formatTokenAmount(0)).toEqual('0.00');
    });
    it('should format undefined', () => {
      expect(formatTokenAmount(undefined)).toEqual('-');
    });
    it('should format numbers smaller than 0.00001', () => {
      expect(formatTokenAmount(0.000009999)).toEqual('<0.00001');
      expect(formatTokenAmount(0.000001)).toEqual('<0.00001');
      expect(formatTokenAmount(0.0000001)).toEqual('<0.00001');
      expect(formatTokenAmount(0.0000000002592)).toEqual('<0.00001');
    });
    it('should format numbers less than 1', () => {
      expect(formatTokenAmount(0.00001)).toEqual('0.00001');
      expect(formatTokenAmount(0.123456)).toEqual('0.12346');
      expect(formatTokenAmount(0.0015234)).toEqual('0.00152');
      expect(formatTokenAmount(0.0000234)).toEqual('0.00002');
      expect(formatTokenAmount(0.00159)).toEqual('0.00159');
    });
    it('should format numbers greater than 1 and less than 10000', () => {
      expect(formatTokenAmount(1)).toEqual('1');
      expect(formatTokenAmount(1.23456)).toEqual('1.23456');
      expect(formatTokenAmount(1.5234)).toEqual('1.5234');
      expect(formatTokenAmount(1.0000234)).toEqual('1.00002');
      expect(formatTokenAmount(1.59)).toEqual('1.59');
      expect(formatTokenAmount(259.14952)).toEqual('259.15');
      expect(formatTokenAmount(9999.22222)).toEqual('9,999.22');
      expect(formatTokenAmount(5259.249324)).toEqual('5,259.25');
    });
    it('should format numbers greater than or equal to 10000 and less than 1000000', () => {
      expect(formatTokenAmount(10000)).toEqual('10,000');
      expect(formatTokenAmount(10000.23456)).toEqual('10,000.2');
      expect(formatTokenAmount(25932.23456)).toEqual('25,932.2');
      expect(formatTokenAmount(452349.23456)).toEqual('452,349');
      expect(formatTokenAmount(999999.23456)).toEqual('999,999');
    });
    it('should format numbers greater than or equal to 1000000', () => {
      expect(formatTokenAmount(1000000)).toEqual('1.000e+6');
      expect(formatTokenAmount(1000000.23456)).toEqual('1.000e+6');
      expect(formatTokenAmount(2593234.23456)).toEqual('2.593e+6');
      expect(formatTokenAmount(45234900.23456)).toEqual('4.523e+7');
      expect(formatTokenAmount(999999999.23456)).toEqual('1.000e+9');
      expect(formatTokenAmount(9999999999.23456)).toEqual('1.000e+10');
      expect(formatTokenAmount(258234020439042242)).toEqual('2.582e+17');
    });
  });
});
