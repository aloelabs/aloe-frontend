import { GREY_600 } from 'shared/lib/data/constants/Colors';
import { getHealthColor } from 'shared/lib/util/Health';

const MAX_HEALTH = 3;
const MIN_HEALTH = 0.5;

export type HealthGaugeProps = {
  health: number;
  size: number;
};

export default function HealthGauge(props: HealthGaugeProps) {
  const { health, size } = props;

  const healthPercent =
    ((Math.max(Math.min(health, MAX_HEALTH), MIN_HEALTH) - MIN_HEALTH) / (MAX_HEALTH - MIN_HEALTH)) * 100;
  const healthColor = getHealthColor(health);

  const strokeWidth = 6;
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthPercent * circumference) / 100;

  return (
    <svg width={size} height={size}>
      <circle stroke={GREY_600} fill='transparent' strokeWidth={strokeWidth} r={radius} cx={size / 2} cy={size / 2} />
      <circle
        stroke={healthColor}
        fill='transparent'
        strokeLinecap='round'
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
    </svg>
  );
}
