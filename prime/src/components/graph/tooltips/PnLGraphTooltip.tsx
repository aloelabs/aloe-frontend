import React from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import { Token } from 'shared/lib/data/Token';
import styled from 'styled-components';
import tw from 'twin.macro';

import { formatNumberRelativeToSize } from '../PnLGraph';

export const PORTFOLIO_TOOLTIP_WIDTH = 175;
const TOOLTIP_BG_COLOR = 'rgba(13, 23, 30, 0.75)';
const TOOLTIP_BORDER_COLOR = GREY_700;

const TooltipContainer = styled.div.attrs((props: { offset: number }) => props)`
  ${tw`rounded-md shadow-md`}
  background: ${TOOLTIP_BG_COLOR};
  border: 1px solid ${TOOLTIP_BORDER_COLOR};
  width: ${PORTFOLIO_TOOLTIP_WIDTH}px;
  box-shadow: 0px 8px 32px 0px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(24px);
  transform: translateX(${(props) => props.offset}px);
`;

export default function PnLGraphTooltip(props: {
  token0: Token;
  token1: Token;
  inTermsOfToken0: boolean;
  showAsterisk: boolean;
  data: any;
  active?: boolean;
}) {
  const { token0, token1, inTermsOfToken0, showAsterisk, data, active } = props;
  if (active) {
    const y = data?.payload[0]?.value || 0;
    const x = data?.label || 0;

    const token0Symbol = token0.symbol;
    const token1Symbol = token1.symbol;
    const symbolActive = inTermsOfToken0 ? token0Symbol : token1Symbol;
    const symbolInactive = inTermsOfToken0 ? token1Symbol : token0Symbol;

    return (
      <TooltipContainer>
        <div className='flex flex-col justify-between gap-2 mt-4 pl-3 pr-3 pb-3'>
          <div className='flex flex-col justify-center items-center'>
            <Text size='S' weight='medium'>
              Price
            </Text>
            <Text size='M' weight='bold'>
              {formatNumberRelativeToSize(x)}
            </Text>
            <Text size='M' weight='bold'>
              {`${symbolActive} / ${symbolInactive}`}
            </Text>
          </div>
          <div className='flex flex-col justify-center items-center'>
            <div className='flex'>
              <Text size='S' weight='medium'>
                P&L
              </Text>
              {showAsterisk && (
                <Text size='S' weight='medium' color='rgba(242, 201, 76, 1)'>
                  *
                </Text>
              )}
            </div>
            <Text size='M' weight='bold'>
              {formatNumberRelativeToSize(y)} {symbolActive}
            </Text>
          </div>
        </div>
      </TooltipContainer>
    );
  }
  return null;
}
