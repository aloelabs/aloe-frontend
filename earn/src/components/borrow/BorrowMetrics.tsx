import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { RESPONSIVE_BREAKPOINT_MD } from '../../data/constants/Breakpoints';
import { MarginAccountPreview } from '../../data/MarginAccount';
import { formatTokenAmount, roundPercentage } from '../../util/Numbers';

const BORROW_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const MAX_HEALTH = 10;
const HEALTH_GREEN = 'rgba(0, 193, 67, 1)';
const HEALTH_YELLOW = 'rgba(242, 201, 76, 1)';
const HEALTH_RED = 'rgba(235, 87, 87, 1)';

const MetricCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  background-color: rgb(13, 23, 30);
  border-radius: 8px;
  padding: 16px;
`;

const HorizontalMetricCardContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  background-color: rgb(13, 23, 30);
  border-radius: 8px;
  padding: 16px;
`;

const HealthDot = styled.div<{ color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${(props) => props.color};
`;

const MetricsGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const MetricsGridUpper = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-gap: 16px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const MetricsGridLower = styled.div`
  display: grid;
  grid-template-columns: 1fr; //repeat(2, 1fr) 1.5fr;
  grid-gap: 16px;

  // @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
  //   grid-template-columns: 1fr;
  // }
`;

function getHealthColor(health: number) {
  if (health <= 1.02) {
    return HEALTH_RED;
  } else if (health <= 1.25) {
    return HEALTH_YELLOW;
  } else {
    return HEALTH_GREEN;
  }
}

function MetricCard(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <MetricCardContainer>
      <Text size='M' color={BORROW_TITLE_TEXT_COLOR}>
        {label}
      </Text>
      <Display size='L'>{value}</Display>
    </MetricCardContainer>
  );
}

function HorizontalMetricCard(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <HorizontalMetricCardContainer>
      <Text size='M' color={BORROW_TITLE_TEXT_COLOR}>
        {label}
      </Text>
      <Display size='S'>{value}</Display>
    </HorizontalMetricCardContainer>
  );
}

function HealthMetricCard(props: { health: number }) {
  const { health } = props;
  const healthLabel = health > MAX_HEALTH ? `${MAX_HEALTH}+` : health.toFixed(2);
  const healthColor = getHealthColor(health);
  return (
    <HorizontalMetricCardContainer>
      <Text size='M' color={BORROW_TITLE_TEXT_COLOR}>
        Health
      </Text>
      <div className='flex items-center gap-2'>
        <Display size='S' color={healthColor}>
          {healthLabel}
        </Display>
        <HealthDot color={healthColor} />
      </div>
    </HorizontalMetricCardContainer>
  );
}

export type BorrowMetricsProps = {
  marginAccountPreview?: MarginAccountPreview;
  iv: number;
  dailyInterest0: number;
  dailyInterest1: number;
};

export function BorrowMetrics(props: BorrowMetricsProps) {
  const { marginAccountPreview, iv, dailyInterest0, dailyInterest1 } = props;
  if (!marginAccountPreview) {
    return null;
  }
  return (
    <MetricsGrid>
      <MetricsGridUpper>
        <MetricCard
          label={`${marginAccountPreview.token0.ticker} Collateral`}
          value={formatTokenAmount(marginAccountPreview.assets.token0Raw || 0, 3)}
        />
        <MetricCard
          label={`${marginAccountPreview.token1.ticker} Collateral`}
          value={formatTokenAmount(marginAccountPreview.assets.token1Raw || 0, 3)}
        />
        <MetricCard
          label={`${marginAccountPreview.token0.ticker} Borrows`}
          value={formatTokenAmount(marginAccountPreview.liabilities.amount0 || 0, 3)}
        />
        <MetricCard
          label={`${marginAccountPreview.token1.ticker} Borrows`}
          value={formatTokenAmount(marginAccountPreview.liabilities.amount1 || 0, 3)}
        />
      </MetricsGridUpper>
      <MetricsGridLower>
        <HealthMetricCard health={marginAccountPreview.health || 0} />
        <HorizontalMetricCard label='Liquidation Distance' value='±1020' />
        <HorizontalMetricCard
          label='Daily Interest'
          value={`${formatTokenAmount(dailyInterest0, 2)} ${marginAccountPreview.token0.ticker} + ${formatTokenAmount(
            dailyInterest1,
            2
          )} ${marginAccountPreview.token1.ticker}`}
        />
      </MetricsGridLower>
    </MetricsGrid>
  );
}
