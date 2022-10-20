import React from 'react';
import { roundPercentage } from '../../util/Numbers';
import PositiveChangeIcon from '../../assets/svg/PositiveChangeIcon';
import NegativeChangeIcon from '../../assets/svg/NegativeChangeIcon';
import styled from 'styled-components';
import { Text } from './Typography';
import UpArrow from '../../assets/svg/UpArrow';
import DownArrow from '../../assets/svg/DownArrow';

const POSITIVE_PERCENT_BG_COLOR = 'rgba(0, 193, 67, 0.1)';
const POSITIVE_PERCENT_TEXT_COLOR = 'rgb(0, 193, 67)';
const NEGATIVE_PERCENT_BG_COLOR = 'rgba(255, 255, 255, 0.1)';
const NEGATIVE_PERCENT_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const PERCENT_ROUNDING_PRECISION = 2;

const PercentChangeContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  border-radius: 8px;
  padding: 6px;
  &:after {
    content: '';
    width: 14px;
    height: 14px;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }
`;

export const PositivePercentChangeContainer = styled(PercentChangeContainer)`
  background: ${POSITIVE_PERCENT_BG_COLOR};
`;

export const NegativePercentChangeContainer = styled(PercentChangeContainer)`
  background: ${NEGATIVE_PERCENT_BG_COLOR};
`;

export type PercentChangeProps = {
  percent: number;
};

export function PercentChange(props: PercentChangeProps) {
  const { percent } = props;
  if (percent >= 0) {
    return (
      <PositivePercentChangeContainer>
        <Text size='XS' weight='bold' color={POSITIVE_PERCENT_TEXT_COLOR}>
          +{roundPercentage(percent, PERCENT_ROUNDING_PRECISION)}%
        </Text>
        <PositiveChangeIcon />
      </PositivePercentChangeContainer>
    );
  } else {
    return (
      <NegativePercentChangeContainer>
        <Text size='XS' weight='bold' color={NEGATIVE_PERCENT_TEXT_COLOR}>
          {roundPercentage(percent, PERCENT_ROUNDING_PRECISION)}%
        </Text>
        <NegativeChangeIcon />
      </NegativePercentChangeContainer>
    );
  }
}

const CombinedPercentChangeContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  border-radius: 8px;
  padding: 8px 10px;
`;

const PositiveCombinedPercentChangeContainer = styled(CombinedPercentChangeContainer)`
  background: ${POSITIVE_PERCENT_BG_COLOR};
`;

const NegativeCombinedPercentChangeContainer = styled(CombinedPercentChangeContainer)`
  background: ${NEGATIVE_PERCENT_BG_COLOR};
`;

export type CombinedPercentChangeProps = {
  value: number;
  percent: number;
};

export function CombinedPercentChange(props: CombinedPercentChangeProps) {
  const { value, percent } = props;
  if (percent >= 0) {
    return (
      <PositiveCombinedPercentChangeContainer>
        <UpArrow />
        <Text size='S' weight='medium' color={POSITIVE_PERCENT_TEXT_COLOR}>
          {value.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
          })}{' '}
          ({roundPercentage(percent, PERCENT_ROUNDING_PRECISION)}%)
        </Text>
      </PositiveCombinedPercentChangeContainer>
    );
  } else {
    return (
      <NegativeCombinedPercentChangeContainer>
        <DownArrow />
        <Text size='S' weight='medium' color={NEGATIVE_PERCENT_TEXT_COLOR}>
          {value} ({roundPercentage(percent, PERCENT_ROUNDING_PRECISION)}%)
        </Text>
      </NegativeCombinedPercentChangeContainer>
    );
  }
}
