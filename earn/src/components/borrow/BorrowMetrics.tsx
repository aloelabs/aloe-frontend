import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

const BORROW_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const MAX_HEALTH = 3;
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

function getHealthColor(health: number) {
  if (health <= 1.05) {
    return HEALTH_RED;
  } else if (health <= 1.25) {
    return HEALTH_YELLOW;
  } else {
    return HEALTH_GREEN;
  }
}

export function MetricCard(props: { label: string; value: string }) {
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

export function HorizontalMetricCard(props: { label: string; value: string }) {
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

export function HealthMetricCard(props: { health: number }) {
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
