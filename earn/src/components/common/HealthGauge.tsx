import { useState } from 'react';

import { GREY_600 } from 'shared/lib/data/constants/Colors';
import { getHealthColor } from 'shared/lib/util/Health';
import styled from 'styled-components';

import HealthBar from '../borrow/HealthBar';

const TooltipParent = styled.div`
  display: inline-block;
  position: relative;
  cursor: pointer;
`;

const TooltipWrapper = styled.div`
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);

  box-shadow: 0 0 2rem rgba(0, 0, 0, 0.8);

  padding: 8px;
  width: 300px;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-around;

  border-radius: 8px;
  background-color: rgba(7, 14, 18, 1);
  border: 1px solid rgba(43, 64, 80, 1);
  z-index: 30;
  pointer-events: none;
  white-space: normal;
`;

const MAX_HEALTH = 3;
const MIN_HEALTH = 0.5;

export type HealthGaugeProps = {
  health: number;
  size: number;
};

function HealthSVG(props: HealthGaugeProps) {
  const { health, size } = props;

  const healthPercent =
    ((Math.max(Math.min(health, MAX_HEALTH), MIN_HEALTH) - MIN_HEALTH) / (MAX_HEALTH - MIN_HEALTH)) * 100;
  const healthColor = getHealthColor(health);

  const strokeWidth = Math.sqrt(size);
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthPercent * circumference) / 100;

  return (
    <svg width={size} height={size} transform='rotate(-90)'>
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

export default function HealthGauge(props: HealthGaugeProps) {
  const [isHovering, setIsHovering] = useState(false);

  // TODO: Ideally we'd show things like auctionState / liquidation time as well, not just health.
  return (
    <TooltipParent onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
      <HealthSVG {...props} />
      {isHovering && (
        <TooltipWrapper>
          <HealthBar health={props.health} minimal={true} />
        </TooltipWrapper>
      )}
    </TooltipParent>
  );
}
