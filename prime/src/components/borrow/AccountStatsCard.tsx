import React from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

import { RESPONSIVE_BREAKPOINT_LG, RESPONSIVE_BREAKPOINT_MD } from '../../data/constants/Breakpoints';

const PRIMARY_COLOR = '#ffffff';
const SECONDARY_COLOR = '#82a0b6';
const TERTIARY_COLOR = '#ccdfed';

const AccountStatsCardWrapper = styled.div`
  ${tw`flex flex-col justify-center`}
  background-color: rgba(13, 23, 30, 1);
  border-radius: 8px;
  padding: 24px 32px;
`;

const TextWrapper = styled.div`
  ${tw`flex items-baseline max-w-full overflow-hidden`}
  gap: 6px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_LG}) {
    flex-direction: column;
    gap: 0;

    div:last-child {
      // tweak spacing between value and denomination
      margin-top: -4px;
    }
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    flex-direction: row;
    gap: 6px;
  }
`;

export type AccountStatsCardProps = {
  label: string;
  value: string;
  valueColor?: string;
  denomination?: string;
  showAsterisk: boolean;
  className?: string;
};

export function AccountStatsCard(props: AccountStatsCardProps) {
  const { label, value, valueColor, denomination, showAsterisk, className } = props;
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
        <Display size='L' weight='semibold' color={valueColor ?? PRIMARY_COLOR}>
          {value}
        </Display>
        {denomination !== undefined && (
          <Display size='M' weight='medium' color={TERTIARY_COLOR}>
            {denomination}
          </Display>
        )}
      </TextWrapper>
    </AccountStatsCardWrapper>
  );
}
