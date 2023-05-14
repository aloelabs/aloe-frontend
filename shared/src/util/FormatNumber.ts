export function formatTokenAmount(amount: number | undefined, maxDigits = 6): string {
  if (amount === 0) return '0.00';
  if (!amount) return '-';
  if (amount < 0.00001) return '<0.00001';
  if (amount < 1) {
    return Number(amount.toFixed(maxDigits - 1)).toLocaleString('en-US', {
      maximumSignificantDigits: maxDigits,
      minimumSignificantDigits: 1,
    });
  }
  if (amount < 10000) {
    return Number(amount).toLocaleString('en-US', {
      maximumSignificantDigits: maxDigits,
      minimumSignificantDigits: 1,
    });
  }
  if (amount < 1000000) {
    return Number(amount).toLocaleString('en-US', {
      maximumSignificantDigits: maxDigits,
      minimumSignificantDigits: 1,
    });
  }
  if (amount >= Math.pow(10, maxDigits - 1)) {
    return amount.toExponential(maxDigits - 3);
  }
  return Number(amount.toFixed(2)).toLocaleString('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
  });
}
