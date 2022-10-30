import React from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

import { RESPONSIVE_BREAKPOINT_LG, RESPONSIVE_BREAKPOINT_MD } from '../../data/constants/Breakpoints';

const PRIMARY_COLOR = '#ffffff';
const SECONDARY_COLOR = '#82a0b6';

const AccountStatsCardWrapper = styled.div`
  ${tw`flex flex-col justify-center`}
  background-color: rgba(13, 23, 30, 1);
  border-radius: 8px;
  padding: 24px 32px;
`;

const TextWrapper = styled.div`
  ${tw`flex items-baseline max-w-full overflow-hidden`}
  flex-direction: row;
  gap: 8px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_LG}) {
    flex-direction: column;
    gap: 0;
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    flex-direction: row;
    gap: 8px;
  }
`;

const Box = styled.div.attrs((props: { color: string }) => props)`
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background-color: ${(props) => props.color};
`;

export type AccountStatsCardProps = {
  label: string;
  value: string;
  denomination?: string;
  boxColor?: string;
  showAsterisk: boolean;
  className?: string;
};

export function AccountStatsCard(props: AccountStatsCardProps) {
  const { label, value, denomination, boxColor, showAsterisk, className } = props;
  return (
    <AccountStatsCardWrapper className={className}>
      <div className='flex'>
        <Text size='M' weight='medium' color={SECONDARY_COLOR}>
          {label}
        </Text>
        {showAsterisk && (
          <Text size='M' weight='medium' color='rgba(242, 201, 76, 1)'>
            *
          </Text>
        )}
      </div>
      <TextWrapper>
        <Display size='L' weight='semibold' color={PRIMARY_COLOR}>
          {value}
        </Display>
        <div className='flex gap-2'>
          {denomination !== undefined && (
            <Display size='M' weight='medium' color={SECONDARY_COLOR}>
              {denomination}
            </Display>
          )}
          {boxColor !== undefined && (
            <div className='flex justify-center items-center'>
              <Box color={boxColor} />
            </div>
          )}
        </div>
      </TextWrapper>
    </AccountStatsCardWrapper>
  );
}
