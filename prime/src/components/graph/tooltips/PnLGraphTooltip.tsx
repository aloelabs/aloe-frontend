import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Text } from 'shared/lib/components/common/Typography';
import { TokenData } from '../../../data/TokenData';
import { formatNumberRelativeToSize } from '../PnLGraph';

export const PORTFOLIO_TOOLTIP_WIDTH = 175;
const TOOLTIP_BG_COLOR = 'rgba(13, 23, 30, 0.75)';
const TOOLTIP_BORDER_COLOR = 'rgba(26, 41, 52, 1)';

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
  token0: TokenData;
  token1: TokenData;
  inTermsOfToken0: boolean;
  showAsterisk: boolean;
  data: any;
  active?: boolean;
}) {
  const { token0, token1, inTermsOfToken0, showAsterisk, data, active } = props;
  if (active) {
    const y = data?.payload[0]?.value || 0;
    const x = data?.label || 0;

    const token0Ticker = token0.ticker ?? '';
    const token1Ticker = token1.ticker ?? '';
    const tickerActive = inTermsOfToken0 ? token0Ticker : token1Ticker;
    const tickerInactive = inTermsOfToken0 ? token1Ticker : token0Ticker;

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
              {`${tickerActive} / ${tickerInactive}`}
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
              {formatNumberRelativeToSize(y)} {tickerActive}
            </Text>
          </div>
        </div>
      </TooltipContainer>
    );
  }
  return null;
}
