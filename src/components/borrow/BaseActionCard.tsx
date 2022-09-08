import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Display, Text } from '../common/Typography';
import { ReactComponent as CloseModal } from '../../assets/svg/close_modal.svg';
import { ActionID, ActionProvider, getNameOfAction } from '../../data/Actions';
import Tooltip from '../common/Tooltip';

const ActionCardContainer = styled.div.attrs(
  (props: { isCausingError: boolean }) => props
)`
  ${tw`flex flex-col items-center justify-center`}
  width: 400px;
  padding: 12px 12px;
  border-radius: 8px;
  background-color: rgba(13, 24, 33, 1);
  border: 1px solid ${(props) => props.isCausingError ? 'rgba(255, 54, 69, 1)' : 'rgba(34, 54, 69, 1)'};
  box-shadow: ${(props) => props.isCausingError ? '0px 0px 10px rgba(255, 54, 69, 0.5)' : 'none'};
`;

const ActionBadge = styled.div.attrs(
  (props: { backgroundColor: string }) => props
)`
  ${tw`flex items-center justify-center`}
  width: max-width;
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

export type BaseActionCardProps = {
  actionProvider: ActionProvider;
  action: ActionID;
  isCausingError: boolean;
  children: React.ReactNode;
  onRemove: () => void;
  tooltipContent?: React.ReactNode;
};

export function BaseActionCard(props: BaseActionCardProps) {
  const { actionProvider, action, isCausingError, children, onRemove, tooltipContent } = props;
  return (
    <ActionCardContainer isCausingError={isCausingError}>
      <div className='w-full flex justify-start items-center gap-4 mb-4'>
        <ActionBadge backgroundColor={actionProvider.color}>
          <Text size='S' weight='medium'>
            {getNameOfAction(action)}
          </Text>
        </ActionBadge>
        <div className='flex items-center'>
          <SvgWrapper>
            <actionProvider.Icon />
          </SvgWrapper>
          <Display size='S'>{actionProvider.name}</Display>
        </div>
        {tooltipContent && (
          <Tooltip
            buttonSize='M'
            position='top-center'
            filled={true}
            content={tooltipContent}
          />
        )}
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
