import { Display, Text } from 'shared/lib/components/common/Typography';
import { GNFormat } from 'shared/lib/data/GoodNumber';
import { roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import { RESPONSIVE_BREAKPOINT_XS } from '../../data/constants/Breakpoints';
import { MarginAccount } from '../../data/MarginAccount';
import { MarketInfo } from '../../data/MarketInfo';

const STAT_LABEL_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const STAT_VALUE_TEXT_COLOR = 'rgba(255, 255, 255, 1)';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  /* 16px due to the bottom padding already being 8px making the total space 24px */
  gap: 16px;
  margin-bottom: 64px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    margin-bottom: 48px;
  }
`;

const StatsWidgetGrid = styled.div`
  display: grid;
  grid-template-columns: calc(50% - 12px) calc(50% - 12px);
  column-gap: 24px;
  border-top: 1px solid rgba(26, 41, 52, 1);

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    grid-template-columns: 100%;
  }
`;

const StatContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 18px 8px;
  border-bottom: 1px solid rgba(26, 41, 52, 1);

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    flex-direction: column;
    align-items: flex-start;
    padding: 8px 8px;
  }
`;

export type GlobalStatsTableProps = {
  marginAccount?: MarginAccount;
  marketInfo?: MarketInfo;
};

export default function GlobalStatsTable(props: GlobalStatsTableProps) {
  const { marginAccount, marketInfo } = props;
  if (!marginAccount || !marketInfo) {
    return null;
  }
  const { token0, token1 } = marginAccount;
  return (
    <Wrapper>
      <Text size='M'>Pair Stats</Text>
      <StatsWidgetGrid>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {token0.ticker} Total Supply
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {marketInfo.lender0TotalAssets.toString(GNFormat.LOSSY_HUMAN)}
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {token1.ticker} Total Supply
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {marketInfo.lender1TotalAssets.toString(GNFormat.LOSSY_HUMAN)}
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {token0.ticker} Borrows
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {marketInfo.lender0TotalBorrows.toString(GNFormat.LOSSY_HUMAN)}
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {token1.ticker} Borrows
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {marketInfo.lender1TotalBorrows.toString(GNFormat.LOSSY_HUMAN)}
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {token0.ticker} Utilization
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {roundPercentage(marketInfo.lender0Utilization * 100, 2)}%
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {token1.ticker} Utilization
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {roundPercentage(marketInfo.lender1Utilization * 100, 2)}%
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {token0.ticker} Borrow APR
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {roundPercentage(marketInfo.borrowerAPR0 * 100, 2)}%
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {token1.ticker} Borrow APR
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {roundPercentage(marketInfo.borrowerAPR1 * 100, 2)}%
          </Display>
        </StatContainer>
      </StatsWidgetGrid>
    </Wrapper>
  );
}
