import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { ReactComponent as Check } from '../../../assets/svg/check_black.svg';
import { ReactComponent as ChevronsUp } from '../../../assets/svg/chevrons_up.svg';

const StyledCheck = styled(Check)`
  path {
    stroke: #ffffff;
  }
`;

const StyledChevronsUp = styled(ChevronsUp)`
  path {
    stroke: #ffffff;
  }
`;

const InactiveButton = styled.button`
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
`;

const ActiveButton = styled.button`
  position: relative;
  display: flex;
  gap: 8px;
  padding: 8px 24px 8px 16px;
  background-color: rgba(0, 193, 67, 1);
  border-radius: 8px;
`;

export type OptimizeButtonProps = {
  isOptimized: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

export default function OptimizeButton(props: OptimizeButtonProps) {
  const { isOptimized, onClick } = props;
  const Button = isOptimized ? InactiveButton : ActiveButton;
  const Icon = isOptimized ? StyledCheck : StyledChevronsUp;
  return (
    <Button onClick={onClick} disabled={isOptimized}>
      <Icon />
      <Text size='M' weight='bold'>
        {isOptimized ? 'Optimized' : 'Optimize'}
      </Text>
    </Button>
  );
}
