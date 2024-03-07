import { useState } from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

const TooltipWrapper = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  width: max-content;
  border-radius: 8px;
  text-align: center;
  background-color: rgba(7, 14, 18, 1);
  border: 1px solid rgba(43, 64, 80, 1);
  z-index: 30;
  pointer-events: none;
  white-space: normal;
`;

const PointsBadgeWrapper = styled.div`
  // display: flex;
  // flex-direction: row;
  // background: linear-gradient(90deg, rgba(155, 170, 243, 1) 0%, rgba(123, 216, 192, 1) 100%);

  display: inline-block;
  position: relative;
  cursor: pointer;
  background: rgba(82, 182, 154, 1);
  align-items: center;
  width: fit-content;
  height: 20px;
  padding: 1px 8px 1px 6px;
  border-radius: 4px;
`;

export function ApyWithTooltip(props: { apy: number; addOn?: number }) {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div className='flex items-center gap-2'>
      <Display size='XS'>{props.apy.toFixed(2)}%</Display>
      {props.addOn !== undefined && (
        <PointsBadgeWrapper onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
          <Display size='XXS' color='rgba(6,11,15,1)'>
            +{props.addOn.toFixed(0)} pts
          </Display>
          {isHovering && (
            <TooltipWrapper>
              <Text size='S' weight='medium'>
                loyalty points per $1000 per year
              </Text>
            </TooltipWrapper>
          )}
        </PointsBadgeWrapper>
      )}
    </div>
  );
}
