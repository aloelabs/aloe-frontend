import { Text } from 'shared/lib/components/common/Typography';
import { GREY_800 } from 'shared/lib/data/constants/Colors';
import styled from 'styled-components';

const IN_RANGE_COLOR = '#00C143';
const OUT_OF_RANGE_COLOR = '#EB5757';
const IN_RANGE_BACKGROUND_COLOR = 'rgba(0, 193, 67, 0.1)';
const OUT_OF_RANGE_BACKGROUND_COLOR = 'rgba(235, 87, 87, 0.1)';

export const UniswapPositionCardContainer = styled.div`
  width: 100%;
  max-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const UniswapPositionCardWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  background-color: ${GREY_800};
  border-radius: 8px;
  overflow: hidden;
  padding: 16px;
  width: 100%;
`;

const InRangeBadgeWrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
  background-color: ${IN_RANGE_BACKGROUND_COLOR};
  align-items: center;
  width: fit-content;
  height: 28px;
  padding: 4px 8px;
  border-radius: 8px;

  &:after {
    content: '';
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${IN_RANGE_COLOR};
  }
`;

const OutOfRangeBadgeWrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
  background-color: ${OUT_OF_RANGE_BACKGROUND_COLOR};
  width: fit-content;
  height: 28px;
  padding: 4px 8px;
  border-radius: 8px;

  &:after {
    content: '';
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: ${OUT_OF_RANGE_COLOR};
  }
`;

export function InRangeBadge() {
  return (
    <InRangeBadgeWrapper>
      <Text size='S' color={IN_RANGE_COLOR}>
        In Range
      </Text>
    </InRangeBadgeWrapper>
  );
}

export function OutOfRangeBadge() {
  return (
    <OutOfRangeBadgeWrapper>
      <Text size='S' color={OUT_OF_RANGE_COLOR}>
        Out of Range
      </Text>
    </OutOfRangeBadgeWrapper>
  );
}
