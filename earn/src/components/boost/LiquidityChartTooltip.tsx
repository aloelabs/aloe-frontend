import React from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import { roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import tw from 'twin.macro';

export const PERCENTAGE_WIDTH = 75;
const TOOLTIP_BG_COLOR = 'rgba(13, 23, 30, 1)';
const TOOLTIP_BORDER_COLOR = GREY_700;

const TooltipContainer = styled.div.attrs((props: { offset: number }) => props)`
  ${tw`rounded-md shadow-md`}
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(clamp(0px, ${(props) => props.offset - PERCENTAGE_WIDTH / 2}px, 225px));
  border: 1px solid ${TOOLTIP_BORDER_COLOR};
  width: ${PERCENTAGE_WIDTH}px;
  box-shadow: 0px 8px 32px 0px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(24px);
  background: ${TOOLTIP_BG_COLOR};
  visibility: visible;
`;

export default function LiquidityChartTooltip(props: {
  active: boolean;
  selectedPrice: number;
  currentPrice: number;
  x: number;
}) {
  const { active, selectedPrice, currentPrice, x } = props;
  if (active) {
    const percentChange = ((selectedPrice - currentPrice) / currentPrice) * 100 || 0;
    return (
      <TooltipContainer offset={x}>
        <div className='flex flex-col justify-between gap-2 mt-4 pl-3 pr-3 pb-3'>
          <div className='flex flex-col justify-center items-center'>
            <Text size='M' weight='bold'>
              {roundPercentage(percentChange, 1)}%
            </Text>
          </div>
        </div>
      </TooltipContainer>
    );
  }
  return null;
}
