import React from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

import { RESPONSIVE_BREAKPOINT_LG } from '../../data/constants/Breakpoints';

const SECONDARY_COLOR = '#82a0b6';

const AccountStatsCardWrapper = styled.div`
  ${tw`flex flex-col justify-center`}
  background-color: rgba(13, 23, 30, 1);
  border-radius: 8px;
  padding: 24px 32px;
`;

const TextWrapper = styled.div`
  ${tw`flex items-baseline max-w-full gap-2 overflow-hidden`}

  @media (max-width: ${RESPONSIVE_BREAKPOINT_LG}) {
    flex-direction: column;
    gap: 0;
  }
`;

export type AccountStatsCardProps = {
  label: string;
  valueLine1: string;
  denomination?: string;
  denominationColor?: string;
  showAsterisk: boolean;
  className?: string;
};

export function AccountStatsCard(props: AccountStatsCardProps) {
  const { label, valueLine1, denomination, denominationColor, showAsterisk, className } = props;
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
        <Display size='L' weight='semibold'>
          {valueLine1}
        </Display>
        {denomination !== undefined && (
          <Display size='M' weight='medium' color={denominationColor ?? SECONDARY_COLOR}>
            {denomination}
          </Display>
        )}
      </TextWrapper>
    </AccountStatsCardWrapper>
  );
}
