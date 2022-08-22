import React from "react";
import styled from "styled-components";
import tw from "twin.macro";
import { FilledGradientButtonWithIcon } from "../common/Buttons";
import { Text, Display } from "../common/Typography";
import { ReactComponent as PlusIcon } from "../../assets/svg/plus.svg";

const Wrapper = styled.div`
  ${tw`flex flex-col items-center justify-center`}
  background: rgba(13, 24, 33, 1);
  padding: 12px 16px;
`;

const ActionsList = styled.ul`
  ${tw`flex flex-col items-center justify-center`}
  counter-reset: actions-counter;
`;

const ActionItem = styled.li`
  ${tw`flex flex-row items-center justify-center`}
`;

export default function ManageAccountWidget() {
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
          <ActionItem>
            <FilledGradientButtonWithIcon
              Icon={<PlusIcon />}
              position='leading'
              size='S'
              svgColorType='stroke'
              onClick={() => {}}
            >
              Add Action
            </FilledGradientButtonWithIcon>
          </ActionItem>
        </ActionsList>
        
      </div>
    </Wrapper>
  )
}