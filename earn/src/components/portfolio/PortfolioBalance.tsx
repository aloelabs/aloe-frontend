import { useEffect, useState } from 'react';

import { Display } from 'shared/lib/components/common/Typography';

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const INTERVAL = 100;

export type PortfolioBalanceProps = {
  errorLoadingPrices: boolean;
  totalUsd: number;
  weightedAvgApy: number;
};

export default function PortfolioBalance(props: PortfolioBalanceProps) {
  const { errorLoadingPrices, totalUsd, weightedAvgApy } = props;

  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsedTime((prevEllapsedtime) => prevEllapsedtime + INTERVAL / 1000), INTERVAL);
    return () => clearInterval(id);
  }, []);

  const totalUsdPlusYield = totalUsd * (1 + weightedAvgApy / 100) ** (elapsedTime / SECONDS_PER_YEAR);

  let displayDigits = 2;
  if (totalUsdPlusYield > 0) {
    const smallestIncrement = totalUsd * (1 + weightedAvgApy / 100) ** (INTERVAL / 1000 / SECONDS_PER_YEAR) - totalUsd;
    if (smallestIncrement > 0) {
      displayDigits = Math.max(2, Math.ceil(-Math.log10(smallestIncrement)) - 1);
    }
  }
  const localeArgs = {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: displayDigits,
    maximumFractionDigits: displayDigits,
  };
  const widthReferenceNumber = 10 ** Math.floor(Math.log10(totalUsdPlusYield));

  return (
    <div className='relative'>
      <Display size='L' weight='semibold' className='opacity-0 select-none'>
        {errorLoadingPrices ? '$□□□' : widthReferenceNumber.toLocaleString('en-US', localeArgs)}
      </Display>

      <div className='absolute'>
        <Display size='L' weight='semibold' className='mt-[-1em]'>
          {errorLoadingPrices ? '$□□□' : totalUsdPlusYield.toLocaleString('en-US', localeArgs)}
        </Display>
      </div>
    </div>
  );
}
