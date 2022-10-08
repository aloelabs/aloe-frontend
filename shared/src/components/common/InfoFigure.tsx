import React from 'react';
import styled from 'styled-components';
import { Text } from './Typography';

const DASHED_DIVIDER_BORDER_COLOR = 'rgba(255, 255, 255, 0.6)';
const SILO_TEXT_COLOR = 'rgba(228, 237, 246, 1)';

const InfoContainer = styled.div.attrs((props: { shouldGrow: boolean }) => props)`
  display: flex;
  flex-direction: column;
  flex-grow: ${(props) => (props.shouldGrow ? 1 : 0)};
  gap: 8px;
`;

const InfoItem = styled.div.attrs((props: { figureColor: string }) => props)`
  display: flex;
  align-items: center;
  padding-left: 24px;
  position: relative;
  &::before {
    content: '';
    position: absolute;
    left: 0px;
    top: calc(50% - 4px);
    width: 8px;
    height: 8px;
    border-radius: 100%;
    background: ${(props) => props.figureColor};
  }
  &:first-child::after {
    content: '';
    position: absolute;
    left: 3px;
    top: 16px;
    width: 2px;
    height: 24px;
    background: ${(props) => props.figureColor};
  }
`;

const DashedDivider = styled.div`
  margin-left: 8px;
  margin-right: 8px;
  position: relative;
  flex-grow: 1;
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: calc(50% - 1px);
    width: 100%;
    height: 1px;
    border-bottom: 1px dashed ${DASHED_DIVIDER_BORDER_COLOR};
  }
`;

export type InfoFigureProps = {
  label0: string;
  value0: string;
  label1: string;
  value1: string;
  figureColor: string;
  shouldGrow?: boolean;
};

export default function InfoFigure(props: InfoFigureProps) {
  const { label0, value0, label1, value1, figureColor, shouldGrow } = props;
  return (
    <InfoContainer shouldGrow={shouldGrow}>
      <InfoItem figureColor={figureColor}>
        <Text size='M' weight='medium'>
          {label0}
        </Text>
        <DashedDivider />
        <Text size='S' weight='medium' color={SILO_TEXT_COLOR}>
          {value0}
        </Text>
      </InfoItem>
      <InfoItem figureColor={figureColor}>
        <Text size='M' weight='medium'>
          {label1}
        </Text>
        <DashedDivider />
        <Text size='S' weight='medium' color={SILO_TEXT_COLOR}>
          {value1}
        </Text>
      </InfoItem>
    </InfoContainer>
  );
}
