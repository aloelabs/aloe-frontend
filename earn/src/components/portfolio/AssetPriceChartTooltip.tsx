import React from 'react';

import { format, parseISO } from 'date-fns';
import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

import { formatUSD } from '../../util/Numbers';

const TOOLTIP_BG_COLOR = 'rgba(0, 0, 0, 0.4)';
const TOOLTIP_BORDER_COLOR = 'rgba(255, 255, 255, 0.1)';
const TOOLTIP_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const capitalize = (s: string) => {
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const TooltipContainer = styled.div`
  ${tw`rounded-md shadow-md`}
  background: ${TOOLTIP_BG_COLOR};
  border: 1px solid ${TOOLTIP_BORDER_COLOR};
  outline: none;
  min-width: 130px;
`;

const TooltipTitleContainer = styled.div`
  ${tw`flex flex-col justify-center align-middle pt-3 pl-3 pr-3 pb-1`}
  border-bottom: 1px solid ${TOOLTIP_BORDER_COLOR};
`;

export default function AssetPriceChartTooltip(data: any, active = false) {
  if (active) {
    const payload = data.payload;
    const label = data.label;
    // If there is no payload, return null
    if (!payload || payload.length === 0) {
      return null;
    }
    const labelTop = label ? format(parseISO(label), 'MMM dd, yyyy') : '';
    const labelBottom = label ? format(parseISO(label), 'hh:mm a') : '';

    const tooltipValues = payload.map((item: any, index: number) => {
      const name: string = item.name;
      const color: string = item.color;
      const value: number = item.value;
      return (
        <div className='flex flex-col' key={index}>
          <Text size='XS' weight='medium' color={color}>
            {capitalize(name)}
          </Text>
          <Display size='S' weight='medium' color={color}>
            {formatUSD(value)}
          </Display>
        </div>
      );
    });

    return (
      <TooltipContainer>
        <TooltipTitleContainer>
          <Text size='XS' weight='medium' color={TOOLTIP_TEXT_COLOR}>
            {labelTop}
          </Text>
          <Text size='XS' weight='medium' color={TOOLTIP_TEXT_COLOR}>
            {labelBottom}
          </Text>
        </TooltipTitleContainer>
        <div className='flex flex-col justify-between gap-2 mt-1 pl-3 pr-3 pb-3'>{tooltipValues}</div>
      </TooltipContainer>
    );
  }
  return null;
}
