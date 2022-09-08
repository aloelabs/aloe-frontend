import ToggleButton from '../../components/common/ToggleButton';
import { ReactComponent as EyeIcon } from '../../assets/svg/eye.svg';
import { ReactComponent as EyeOffIcon } from '../../assets/svg/eye-off.svg';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Text } from '../common/Typography';

const StyledHypotheticalToggleButtonContent = styled.div`
  ${tw`flex items-center gap-2`}
  background-color: rgba(13, 24, 33, 1);
  padding: 8px;
  border: 1px solid rgba(242, 201, 76, 1);
  border-radius: 8px;
`;

const EyeIconWrapper = styled.div`
  width: 24px;
  height: 24px;

  svg {
    width: 24px;
    height: 24px;

    path {
      stroke: rgb(255, 255, 255);
    }
  }
`;

export type HypotheticalToggleButtonProps = {
  showHypothetical: boolean;
  setShowHypothetical: (showHypothetical: boolean) => void;
};

export function HypotheticalToggleButton(props: HypotheticalToggleButtonProps) {
  const { showHypothetical, setShowHypothetical } = props;
  return (
    <ToggleButton
      isActive={showHypothetical}
      setIsActive={setShowHypothetical}
    >
      <StyledHypotheticalToggleButtonContent>
        <Text weight='bold'>Hypothetical</Text>
        <EyeIconWrapper>
          {showHypothetical ? <EyeOffIcon /> : <EyeIcon />}
        </EyeIconWrapper>
      </StyledHypotheticalToggleButtonContent>
    </ToggleButton>
  );
}
