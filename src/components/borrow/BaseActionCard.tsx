import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Display, Text } from '../common/Typography';
import { ReactComponent as CloseModal } from '../../assets/svg/close_modal.svg';
import { ActionProvider } from '../../data/Actions';

const ActionCardContainer = styled.div`
  ${tw`flex flex-col items-center justify-center`}
  width: 400px;
  padding: 12px 24px;
  border-radius: 8px;
  background-color: rgba(13, 24, 33, 1);
  border: 1px solid rgba(34, 54, 69, 1);
`;

const ActionBadge = styled.div.attrs(
  (props: { backgroundColor: string }) => props
)`
  ${tw`flex items-center justify-center`}
  width: max-width;
  padding: 12px 8px;
  border-radius: 8px;
  background-color: ${(props) => props.backgroundColor};
`;

const SvgWrapper = styled.div`
  ${tw`flex items-center justify-center`}
  width: 32px;
  height: 32px;

  svg {
    width: 32px;
    height: 32px;
  }
`;

export type BaseActionCardProps = {
  actionProvider: ActionProvider;
  action: string;
  children: React.ReactNode;
  onRemove: () => void;
};

export function BaseActionCard(props: BaseActionCardProps) {
  const { actionProvider, action, children, onRemove } = props;
  return (
    <ActionCardContainer>
      <div className='w-full flex justify-start items-center gap-4 mb-4'>
        <ActionBadge backgroundColor={actionProvider.color}>
          <Text size='S' weight='medium'>
            {action}
          </Text>
        </ActionBadge>
        <div className='flex items-center'>
          <SvgWrapper>
            <actionProvider.Icon />
          </SvgWrapper>
          <Display size='S'>{actionProvider.name}</Display>
        </div>
        <button type='button' title='Remove' className='ml-auto'>
          <SvgWrapper>
            <CloseModal onClick={onRemove} />
          </SvgWrapper>
        </button>
      </div>
      {children}
    </ActionCardContainer>
  );
}
