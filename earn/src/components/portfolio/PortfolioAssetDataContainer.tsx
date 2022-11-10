import { useState } from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';

import { TokenData } from '../../data/TokenData';
import { TokenBalance } from '../../pages/PortfolioPage';
import { rgba } from '../../util/Colors';
import { formatTokenAmountCompact, roundPercentage } from '../../util/Numbers';
import { APYContainer, BalanceContainer, PieChartContainer } from './PortfolioGrid';
import PortfolioPieChartWidget, { PortfolioPieChartSlice } from './PortfolioPieChartWidget';

export type PortfolioAssetDataContainerProps = {
  balances: TokenBalance[];
  activeAsset: TokenData | null;
  activeColor?: string;
};

export default function PortfolioAssetDataContainer(props: PortfolioAssetDataContainerProps) {
  const { balances, activeAsset, activeColor } = props;

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const activeBalances = balances.filter(
    (balance) => activeAsset && balance.token.referenceAddress === activeAsset.referenceAddress
  );
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
      <BalanceContainer className={activeIndex !== -1 ? 'active' : ''}>
        <Text size='M' weight='bold' color='rgba(130, 160, 182, 1)'>
          Balance
        </Text>
        <div>
          <Display size='L' className='inline-block mr-0.5'>
            {formatTokenAmountCompact(totalBalance, 3)}
          </Display>
          <Display size='S' className='inline-block ml-0.5'>
            {activeAsset?.ticker || ''}
          </Display>
        </div>
      </BalanceContainer>
      <APYContainer className={activeIndex !== -1 ? 'active' : ''}>
        <Text size='M' weight='bold' color='rgba(130, 160, 182, 1)'>
          APY
        </Text>
        <Display size='L'>{roundPercentage(apy, 3)}%</Display>
      </APYContainer>
    </>
  );
}
