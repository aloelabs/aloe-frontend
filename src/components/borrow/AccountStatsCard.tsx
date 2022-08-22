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
  className?: string;
};

export function AccountStatsCard(props: AccountStatsCardProps) {
  const { label, value, className } = props;
  return (
    <AccountStatsCardWrapper className={className}>
      <Text size='S' weight='medium' color={SECONDARY_COLOR}>
        {label}
      </Text>
      <Text size='L' weight='medium'>
        {value}
      </Text>
    </AccountStatsCardWrapper>
  );
}
