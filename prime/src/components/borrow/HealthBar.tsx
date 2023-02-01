import { Display } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

const MAX_HEALTH = 3;
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
    ((Math.max(Math.min(health, MAX_HEALTH), MIN_HEALTH) - MIN_HEALTH) / (MAX_HEALTH - MIN_HEALTH)) * 100;
  const healthLabel = health > MAX_HEALTH ? `${MAX_HEALTH}+` : health.toFixed(2);
  return (
    <div className='w-full flex flex-col align-middle mt-[-24px]'>
      <Display size='L' weight='medium' className='text-center'>
        {healthLabel}
      </Display>
      <HealthBarContainer>
        <HealthBarDial healthPercent={healthPercent} />
      </HealthBarContainer>
    </div>
  );
}
