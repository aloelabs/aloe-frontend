import React from 'react';
import { Text } from 'shared/lib/components/common/Typography';
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
  valueLine1: string;
  valueLine2?: string;
  showAsterisk: boolean;
  className?: string;
};

export function AccountStatsCard(props: AccountStatsCardProps) {
  const { label, valueLine1, valueLine2, showAsterisk, className } = props;
  return (
    <AccountStatsCardWrapper className={className}>
      <div className='flex'>
        <Text size='S' weight='medium' color={SECONDARY_COLOR}>
          {label}
        </Text>
        {showAsterisk && (
          <Text size='S' weight='medium' color='rgba(242, 201, 76, 1)'>*</Text>
        )}
      </div>
      <Text size='L' weight='medium'>{valueLine1}</Text>
      {(valueLine2 !== undefined) && (<Text size='L' weight='medium'>{valueLine2}</Text>)}
    </AccountStatsCardWrapper>
  );
}
