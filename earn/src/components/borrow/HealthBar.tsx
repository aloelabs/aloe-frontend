import Tooltip from 'shared/lib/components/common/Tooltip';
import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

const MAX_HEALTH = 3;
const MIN_HEALTH = 0.5;

const HealthBarContainer = styled.div`
  width: 100%;
  height: 16px;
  background: rgb(235, 87, 87);
  background: linear-gradient(
    90deg,
    rgba(235, 87, 87, 1) 0%,
    rgba(235, 87, 87, 1) 20%,
    rgba(242, 201, 76, 1) 23%,
    rgba(0, 193, 67, 1) 70%,
    rgba(0, 193, 67, 1) 100%
  );
  border-radius: 4px;
  position: relative;
`;

const HealthBarDial = styled.div.attrs((props: { healthPercent: number }) => props)`
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 5px 5px 0 5px;
  border-color: #ffffff transparent transparent transparent;
  position: absolute;
  left: ${(props) => props.healthPercent}%;
  transform: translateX(-50%);
  top: -2.325px;
`;

export type HealthBarProps = {
  health: number;
};

// NOTE: This component's text is smaller than the version on prime.
// This is because of where it is used in the UI. If this needs to be
// used in other places, with different needs, we should make it more flexible.
export default function HealthBar(props: HealthBarProps) {
  const { health } = props;
  // Bound health between MIN_HEALTH and MAX_HEALTH
  const healthPercent =
    ((Math.max(Math.min(health, MAX_HEALTH), MIN_HEALTH) - MIN_HEALTH) / (MAX_HEALTH - MIN_HEALTH)) * 100;
  const healthLabel = health > MAX_HEALTH ? `${MAX_HEALTH}+` : health.toFixed(2);
  return (
    <div className='w-full flex flex-col align-middle'>
      <div className='flex gap-2 items-center mb-4'>
        <Tooltip
          buttonSize='S'
          content={`Health is a measure of how close your account is to being liquidated.
              It is calculated by dividing your account's assets by its liabilities.
              If your health is at or below 1.0, your account may be liquidated.`}
          position='top-left'
        />
        <Text size='S' weight='medium'>
          Account Health:
        </Text>
        <Display size='XS' weight='medium' className='text-center'>
          {healthLabel}
        </Display>
      </div>
      <HealthBarContainer>
        <HealthBarDial healthPercent={healthPercent} data-testid='health-bar-dial' />
      </HealthBarContainer>
    </div>
  );
}
