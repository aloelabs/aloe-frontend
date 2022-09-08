import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { FilledGradientButtonWithIcon } from '../common/Buttons';
import { Text, Display } from '../common/Typography';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';
import { ReactComponent as CheckIcon } from '../../assets/svg/check_black.svg';
import { Action, ActionCardState } from '../../data/Actions';
import { TokenData } from '../../data/TokenData';
import { FeeTier } from '../../data/FeeTier';

const Wrapper = styled.div`
  ${tw`flex flex-col items-center justify-center`}
  background: rgba(13, 24, 33, 1);
  padding: 24px;
  border-radius: 8px;
  width: max-content;
`;

const ActionsList = styled.ul`
  ${tw`flex flex-col items-center`}
  position: relative;
  margin-top: 16px;

  &::before {
    content: '';
    position: absolute;
    left: 15px;
    width: 3px;
    height: 100%;
    border-left: 3px dotted rgba(255, 255, 255, 1);
  }
`;

const ActionItem = styled.li`
  ${tw`w-full flex flex-row items-center`}
  margin-bottom: 16px;
`;

const ActionItemCount = styled.span`
  ${tw`flex flex-col items-center justify-center`}
  position: relative;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 1);
  border: 2px solid rgba(13, 24, 33, 1);
  width: 32px;
  height: 32px;
  margin-right: 32px;
  margin-top: 17px;
  margin-bottom: 17px;
`;

export type ManageAccountWidgetProps = {
  token0: TokenData;
  token1: TokenData;
  kitty0: TokenData;
  kitty1: TokenData;
  feeTier: FeeTier;
  activeActions: Array<Action>;
  actionResults: Array<ActionCardState>;
  updateActionResults: (actionResults: Array<ActionCardState>) => void;
  onAddAction: () => void;
  onRemoveAction: (index: number) => void;
  problematicActionIdx: number;
};

export default function ManageAccountWidget(props: ManageAccountWidgetProps) {
  const {
    token0,
    token1,
    kitty0,
    kitty1,
    feeTier,
    activeActions,
    actionResults,
    updateActionResults,
    onAddAction,
    onRemoveAction,
    problematicActionIdx,
  } = props;
  return (
    <Wrapper>
      <div>
        <Display size='M' weight='medium'>
          Manage Account
        </Display>
        <Text size='S' weight='medium'>
          Get started by clicking "Add Action" and transferring some funds as
          margin.
        </Text>
        <ActionsList>
          {activeActions.map((action, index) => (
            <ActionItem key={index}>
              <ActionItemCount>
                <Text size='M' weight='bold' color='rgba(13, 24, 33, 1)'>
                  {index + 1}
                </Text>
              </ActionItemCount>
              <action.actionCard
                token0={token0}
                token1={token1}
                kitty0={kitty0}
                kitty1={kitty1}
                feeTier={feeTier}
                previousActionCardState={actionResults[index]}
                isCausingError={problematicActionIdx !== -1 && index >= problematicActionIdx}
                onRemove={() => {
                  onRemoveAction(index);
                }}
                onChange={(result: ActionCardState) => {
                  console.log(result);
                  updateActionResults([
                    ...actionResults.slice(0, index),
                    result,
                    ...actionResults.slice(index + 1),
                  ]);
                }}
              />
            </ActionItem>
          ))}
          <ActionItem>
            <ActionItemCount>
              <Text size='M' weight='bold' color='rgba(13, 24, 33, 1)'>
                {activeActions.length + 1}
              </Text>
            </ActionItemCount>
            <FilledGradientButtonWithIcon
              Icon={<PlusIcon />}
              position='leading'
              size='S'
              svgColorType='stroke'
              onClick={() => {
                onAddAction();
              }}
            >
              Add Action
            </FilledGradientButtonWithIcon>
          </ActionItem>
        </ActionsList>
        <div className='flex justify-end gap-4 mt-4'>
          <FilledGradientButtonWithIcon
            Icon={<CheckIcon />}
            position='trailing'
            size='M'
            svgColorType='stroke'
            disabled={activeActions.length === 0}
          >
            Confirm
          </FilledGradientButtonWithIcon>
        </div>
      </div>
    </Wrapper>
  );
}
