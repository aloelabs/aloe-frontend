import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

import { ReactComponent as AlertTriangleIcon } from '../../../assets/svg/alert_triangle.svg';

const Container = styled.div`
  ${tw`flex flex-col items-start justify-evenly`}
  max-width: 350px;
  width: 100%;
  height: 227px;
  margin-top: 3px;
  margin-bottom: 20px;
  background: #0d171e;
`;

const AlertTriangleIconStyled = styled(AlertTriangleIcon)`
  width: 32px;
  height: 32px;
  margin-bottom: 8px;

  path {
    fill: #ff7a00;
  }
`;

export default function LiquidityChartNotAvailable() {
  return (
    <Container>
      <div className='flex flex-col items-center justify-evenly w-full'>
        <AlertTriangleIconStyled />
        <Text size='M' className='text-center'>
          No chart available for this pair.
        </Text>
        <Text size='M' color='rgba(130, 160, 182, 1)' className='text-center'>
          This does not affect your ability to add liquidity.
        </Text>
      </div>
    </Container>
  );
}
