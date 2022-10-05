import React from 'react';
import styled from 'styled-components';
import { Text } from './Typography';

const BADGE_TEXT_COLOR = 'rgba(204, 223, 237, 1)';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  height: 36px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 100px;
`;

export type RoundedBadgeProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
};

export default function RoundedBadge(props: RoundedBadgeProps) {
  const { children, className, title } = props;
  return (
    <Wrapper className={className}>
      <Text size='S' weight='medium' color={BADGE_TEXT_COLOR} title={title}>
        {children}
      </Text>
    </Wrapper>
  );
}
