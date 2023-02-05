import { useEffect, useState } from 'react';

import { Display } from 'shared/lib/components/common/Typography';

export type PortfolioBalanceProps = {
  errorLoadingPrices: boolean;
  totalUsd: number;
  weightedAvgApy: number;
};

const INTERVAL = 100;

export default function PortfolioBalance(props: PortfolioBalanceProps) {
  const { errorLoadingPrices, totalUsd, weightedAvgApy } = props;

  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setElapsedTime(elapsedTime + INTERVAL / 1000), INTERVAL - (Date.now() % INTERVAL));
    return () => clearTimeout(id);
  }, [elapsedTime]);

  // console.log(elapsedTime);

  const secondsPerYear = 365 * 24 * 60 * 60;
  const totalUsdPlusYield = totalUsd * (1 + weightedAvgApy / 100) ** (elapsedTime / secondsPerYear);

  let displayDigits = 2;
  if (totalUsdPlusYield > 0) {
    const smallestIncrement = totalUsd * (1 + weightedAvgApy / 100) ** (INTERVAL / 1000 / secondsPerYear) - totalUsd;
    displayDigits = Math.max(2, Math.ceil(-Math.log10(smallestIncrement)) - 2);
  }

  return (
    <Display size='L' weight='semibold'>
      {errorLoadingPrices
        ? '$□□□'
        : totalUsdPlusYield.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: displayDigits,
            maximumFractionDigits: displayDigits,
          })}
    </Display>
  );
}
