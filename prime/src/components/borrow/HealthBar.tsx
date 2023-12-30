import Tooltip from 'shared/lib/components/common/Tooltip';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { getHealthColor } from 'shared/lib/util/Health';
import styled from 'styled-components';

const MAX_HEALTH_BAR = 3;
const MAX_HEALTH_LABEL = 5;
const MIN_HEALTH = 0.5;

const HealthBarContainer = styled.div`
  width: 100%;
  height: 32px;
  background: rgb(235, 87, 87);
  background: linear-gradient(
    90deg,
    rgba(235, 87, 87, 1) 0%,
    rgba(235, 87, 87, 1) 20%,
    rgba(242, 201, 76, 1) 23%,
    rgba(0, 193, 67, 1) 70%,
    rgba(0, 193, 67, 1) 100%
  );
  border-radius: 8px;
  position: relative;
`;

const HealthBarDial = styled.div.attrs((props: { healthPercent: number }) => props)`
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 10px 10px 0 10px;
  border-color: #ffffff transparent transparent transparent;
  position: absolute;
  left: ${(props) => props.healthPercent}%;
  transform: translateX(-50%);
  top: -4.325px;
`;

export type HealthBarProps = {
  health: number;
};

export default function HealthBar(props: HealthBarProps) {
  const { health } = props;
  // Bound health between MIN_HEALTH and MAX_HEALTH
  const healthPercent =
    ((Math.max(Math.min(health, MAX_HEALTH_BAR), MIN_HEALTH) - MIN_HEALTH) / (MAX_HEALTH_BAR - MIN_HEALTH)) * 100;
  const healthLabel = health > MAX_HEALTH_LABEL ? `${MAX_HEALTH_LABEL}+` : health.toFixed(4);
  const healthLabelColor = getHealthColor(health);

  return (
    <div className='w-full flex flex-col align-middle mb-8 mt-8'>
      <div className='flex gap-2 items-center mb-4'>
        <Tooltip
          buttonSize='M'
          content={`Health is a measure of how close your account is to being liquidated.
              It is calculated by dividing your account's assets by its liabilities.
              If your health is at or below 1.0, your account may be liquidated.`}
          position='top-left'
        />
        <Text size='L' weight='medium'>
          Account Health:
        </Text>
        <Display size='M' weight='medium' className='text-center' color={healthLabelColor}>
          {healthLabel}
        </Display>
      </div>
      <HealthBarContainer>
        <HealthBarDial healthPercent={healthPercent} data-testid='health-bar-dial' />
      </HealthBarContainer>
    </div>
  );
}
