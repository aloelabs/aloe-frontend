import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { ReactComponent as AlertIcon } from '../../assets/svg/alert_triangle.svg';

const Container = styled.div`
  width: 100%;
  padding: 48px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const StyledAlertIcon = styled(AlertIcon)`
  path {
    fill: #ffff;
    stroke: rgb(6, 11, 15);
  }
`;

export default function AccountNotFound() {
  return (
    <Container>
      <StyledAlertIcon width={48} height={48} />
      <Text size='XL' weight='bold' className='text-center'>
        Account not found
      </Text>
      <Text size='L' weight='medium' className='text-center'>
        Please check the provided address and your current network.
      </Text>
    </Container>
  );
}
