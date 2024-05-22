import { useState } from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { rgba } from 'shared/lib/util/Colors';
import { formatTokenAmount, roundPercentage } from 'shared/lib/util/Numbers';

import { APYContainer, BalanceContainer, PieChartContainer } from './PortfolioGrid';
import PortfolioPieChartWidget, { PortfolioPieChartSlice } from './PortfolioPieChartWidget';
import { TokenBalance } from '../../pages/PortfolioPage';

export type PortfolioMetricsProps = {
  balances: TokenBalance[];
  activeAsset: Token | null;
  activeColor?: string;
};

/**
 * A component that displays the portfolio metrics for the active asset.
 * This includes a pie, balance, and APY.
 */
export default function PortfolioMetrics(props: PortfolioMetricsProps) {
  const { balances, activeAsset, activeColor } = props;

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const activeBalances =
    activeAsset != null
      ? balances.filter((balance) => {
          const balanceTokenAddress = balance.token.underlying.address;
          const activeAssetAddress = activeAsset.address;
          return balanceTokenAddress === activeAssetAddress;
        })
      : [];
  const totalTokenBalance = activeBalances.reduce((acc, balance) => acc + balance.balance, 0);
  const activeSlices: PortfolioPieChartSlice[] = activeBalances.map((balance: TokenBalance, i: number) => {
    return {
      token: balance.token,
      percent: balance.balance / totalTokenBalance || 0,
      color: activeColor ? rgba(activeColor, (i + 1) / activeBalances.length) : 'transparent',
      isKitty: balance.isKitty,
      pairName: balance.pairName,
      index: i,
    };
  });
  const activeSlice = activeIndex >= 0 ? activeSlices[activeIndex] : null;
  let totalBalance = totalTokenBalance;
  let apySum = activeBalances.reduce((acc, balance) => acc + balance.apy * balance.balance, 0);
  let apy = apySum / totalBalance || 0;
  if (activeSlice) {
    totalBalance = activeBalances[activeIndex].balance;
    apySum = activeBalances[activeIndex].apy;
    apy = apySum;
  }
  const isHoveringOverSlice = activeIndex >= 0;
  return (
    <>
      <PieChartContainer>
        <PortfolioPieChartWidget
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          slices={activeSlices}
          token={activeAsset}
        />
      </PieChartContainer>
      <BalanceContainer className={isHoveringOverSlice ? 'active' : ''}>
        <Text size='S' weight='bold' color='rgba(130, 160, 182, 1)'>
          Balance
        </Text>
        <div>
          <Display size='L' className='inline-block mr-0.5'>
            {formatTokenAmount(totalBalance, 3)}
          </Display>
          <Display size='XS' className='inline-block ml-0.5'>
            {activeAsset?.symbol || ''}
          </Display>
        </div>
      </BalanceContainer>
      <APYContainer className={isHoveringOverSlice ? 'active' : ''}>
        <Text size='S' weight='bold' color='rgba(130, 160, 182, 1)'>
          APY
        </Text>
        <Display size='L'>{roundPercentage(apy, 3)}%</Display>
      </APYContainer>
    </>
  );
}
