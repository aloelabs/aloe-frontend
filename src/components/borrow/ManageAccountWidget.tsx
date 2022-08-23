import React from "react";
import styled from "styled-components";
import tw from "twin.macro";
import { FilledGradientButtonWithIcon } from "../common/Buttons";
import { Text, Display } from "../common/Typography";
import { ReactComponent as PlusIcon } from "../../assets/svg/plus.svg";
import { Action } from "./ActionCard";
import { TokenData } from "../../data/TokenData";

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
  activeActions: Array<Action>;
  onAddAction: () => void;
  onRemoveAction: (index: number) => void;
};

export default function ManageAccountWidget(props: ManageAccountWidgetProps) {
  const { token0, token1, activeActions, onAddAction, onRemoveAction } = props;
  return (
    <Wrapper>
      <div>
        <Display size='M' weight='medium'>
          Manage Account
        </Display>
        <Text size='S' weight='medium'>
          Get started by clicking "Add Action" and transferring some funds as margin.
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
                onRemove={() => {
                  onRemoveAction(index);
                }}
                onChange={() => {

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
      </div>
    </Wrapper>
  )
}