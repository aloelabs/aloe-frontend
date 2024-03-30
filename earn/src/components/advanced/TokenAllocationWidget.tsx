import { useMemo } from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import styled from 'styled-components';

import { ReactComponent as PieChartIcon } from '../../assets/svg/pie_chart.svg';
import { sqrtRatioToTick } from '../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../data/BorrowerNft';
import TokenAllocationPieChartWidget from './TokenAllocationPieChartWidget';

const ACCENT_COLOR = 'rgba(130, 160, 182, 1)';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const EmptyStateContainer = styled.div`
  max-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
  background-color: ${GREY_700};
`;

const StyledPieChartIcon = styled(PieChartIcon)`
  path {
    stroke: ${ACCENT_COLOR};
  }
`;

export type TokenAllocationWidgetProps = {
  borrower?: BorrowerNftBorrower;
  tokenColors: Map<string, string>;
};

export function TokenAllocationWidget(props: TokenAllocationWidgetProps) {
  const { borrower, tokenColors } = props;

  const totalAmount = useMemo(() => {
    if (borrower === undefined) return 0;
    const currentTick = sqrtRatioToTick(borrower.sqrtPriceX96);
    return borrower.assets.amountsAt(currentTick).reduce((acc, amount) => {
      return acc + amount;
    }, 0);
  }, [borrower]);

  return (
    <Container>
      <Text size='M'>Token Allocation</Text>
      {borrower === undefined || totalAmount === 0 ? (
        <EmptyStateContainer>
          <StyledPieChartIcon />
          <Text size='S' color={ACCENT_COLOR} className='text-center'>
            A breakdown of your token allocation will appear here.
          </Text>
        </EmptyStateContainer>
      ) : (
        <TokenAllocationPieChartWidget borrower={borrower} tokenColors={tokenColors} />
      )}
    </Container>
  );
}
