import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import { GNFormat } from 'shared/lib/data/GoodNumber';
import { roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import { RESPONSIVE_BREAKPOINT_XS } from '../../data/constants/Breakpoints';
import { LendingPair } from '../../data/LendingPair';

const STAT_LABEL_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const STAT_VALUE_TEXT_COLOR = 'rgba(255, 255, 255, 1)';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  /* 16px due to the bottom padding already being 8px making the total space 24px */
  gap: 16px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    margin-bottom: 48px;
  }
`;

const StatsWidgetGrid = styled.div`
  display: grid;
  grid-template-columns: calc(50% - 12px) calc(50% - 12px);
  column-gap: 24px;
  border-top: 1px solid ${GREY_700};

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
  border-bottom: 1px solid ${GREY_700};

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    flex-direction: column;
    align-items: flex-start;
    padding: 8px 8px;
  }
`;

export type GlobalStatsTableProps = {
  market?: LendingPair;
};

export default function GlobalStatsTable(props: GlobalStatsTableProps) {
  const { market } = props;

  return (
    <Wrapper>
      <Text size='M'>Pair Stats</Text>
      <StatsWidgetGrid>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {market?.token0.symbol} Total Supply
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {market?.kitty0Info.totalAssets.toString(GNFormat.LOSSY_HUMAN) ?? '-'}
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {market?.token1.symbol} Total Supply
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {market?.kitty1Info.totalAssets.toString(GNFormat.LOSSY_HUMAN) ?? '-'}
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {market?.token0.symbol} Borrows
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {market?.kitty0Info.totalBorrows.toString(GNFormat.LOSSY_HUMAN) ?? '-'}
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {market?.token1.symbol} Borrows
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {market?.kitty1Info.totalBorrows.toString(GNFormat.LOSSY_HUMAN) ?? '-'}
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {market?.token0.symbol} Utilization
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {market ? roundPercentage(market.kitty0Info.utilization * 100, 2) : '-'}%
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {market?.token1.symbol} Utilization
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {market ? roundPercentage(market.kitty1Info.utilization * 100, 2) : '-'}%
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {market?.token0.symbol} Borrow APR
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {market ? roundPercentage(market.kitty0Info.borrowAPR * 100, 2) : '-'}%
          </Display>
        </StatContainer>
        <StatContainer>
          <Text size='M' color={STAT_LABEL_TEXT_COLOR}>
            {market?.token1.symbol} Borrow APR
          </Text>
          <Display size='S' color={STAT_VALUE_TEXT_COLOR}>
            {market ? roundPercentage(market.kitty1Info.borrowAPR * 100, 2) : '-'}%
          </Display>
        </StatContainer>
      </StatsWidgetGrid>
    </Wrapper>
  );
}
