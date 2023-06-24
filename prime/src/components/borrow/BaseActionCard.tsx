import React from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

import { ReactComponent as CloseModal } from '../../assets/svg/close_modal.svg';
import { ActionID, getNameOfAction } from '../../data/actions/ActionID';
import { ActionProvider } from '../../data/actions/Actions';
import Tooltip from '../common/Tooltip';

const ActionCardContainer = styled.div.attrs((props: { isCausingError: boolean }) => props)`
  ${tw`flex flex-col items-center justify-center`}
  width: 100%;
  padding: 12px 12px;
  border-radius: 8px;
  background-color: rgba(13, 23, 30, 1);
  border: 1px solid ${(props) => (props.isCausingError ? 'rgba(255, 54, 69, 1)' : 'rgba(34, 54, 69, 1)')};
  box-shadow: ${(props) => (props.isCausingError ? '0px 0px 10px rgba(255, 54, 69, 0.5)' : 'none')};
`;

const ActionBadge = styled.div.attrs((props: { backgroundColor: string }) => props)`
  ${tw`flex items-center justify-center`}
  width: max-content;
  padding: 8px 8px;
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

const ErrorMsgContainer = styled.div`
  ${tw`flex items-center justify-center`}
  width: 100%;
  padding: 8px 12px;
  margin-top: 8px;
  background-color: rgba(255, 54, 69, 1);
  box-shadow: 0px 0px 10px rgba(255, 54, 69, 0.5);
  border-radius: 6px;
`;

export type BaseActionCardProps = {
  actionProvider: ActionProvider;
  action: ActionID;
  isCausingError: boolean;
  children: React.ReactNode;
  onRemove: () => void;
  tooltipContent?: React.ReactNode;
  errorMsg?: string;
};

export function BaseActionCard(props: BaseActionCardProps) {
  const { actionProvider, action, isCausingError, children, onRemove, tooltipContent, errorMsg } = props;
  return (
    <ActionCardContainer isCausingError={isCausingError}>
      <div className='w-full grid grid-cols-3 mb-4'>
        <ActionBadge backgroundColor={actionProvider.color}>
          <Text size='S' weight='medium'>
            {getNameOfAction(action)}
          </Text>
        </ActionBadge>
        <div className='flex items-center justify-center'>
          <SvgWrapper>
            <actionProvider.Icon />
          </SvgWrapper>
          <Display size='S'>{actionProvider.name}</Display>
          <div className='w-2' />
          {tooltipContent && <Tooltip buttonSize='M' position='top-center' filled={true} content={tooltipContent} />}
        </div>
        <button type='button' title='Remove' className='ml-auto'>
          <SvgWrapper>
            <CloseModal onClick={onRemove} />
          </SvgWrapper>
        </button>
      </div>
      {children}
      {errorMsg && (
        <ErrorMsgContainer>
          <Text size='S' weight='medium'>
            {errorMsg}
          </Text>
        </ErrorMsgContainer>
      )}
    </ActionCardContainer>
  );
}
