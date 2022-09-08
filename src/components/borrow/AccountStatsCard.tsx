import React from 'react';
import { Text } from '../common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

const SECONDARY_COLOR = '#82a0b6';

const AccountStatsCardWrapper = styled.div`
  ${tw`flex flex-col justify-center`}
  background-color: rgba(13, 24, 33, 1);
  border-radius: 4px;
  padding: 12px 16px;
`;

export type AccountStatsCardProps = {
  label: string;
  value: string;
  hypothetical?: string;
  showHypothetical?: boolean;
  className?: string;
};

export function AccountStatsCard(props: AccountStatsCardProps) {
  const { label, value, hypothetical, showHypothetical, className } = props;
  return (
    <AccountStatsCardWrapper className={className}>
      <div className='flex'>
        <Text size='S' weight='medium' color={SECONDARY_COLOR}>
          {label}
        </Text>
        {showHypothetical && (
          <Text size='S' weight='medium' color='rgba(242, 201, 76, 1)'>*</Text>
        )}
      </div>
      {!showHypothetical && (
        <Text size='L' weight='medium'>
          {value}
        </Text>
      )}
      {showHypothetical && (
        <Text size='L' weight='medium'>{hypothetical ?? value}</Text>
      )}
    </AccountStatsCardWrapper>
  );
}
