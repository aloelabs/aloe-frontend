import ToggleButton from '../../components/common/ToggleButton';
import { ReactComponent as EyeIcon } from '../../assets/svg/eye.svg';
import { ReactComponent as EyeOffIcon } from '../../assets/svg/eye-off.svg';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Text } from 'shared/lib/components/common/Typography';
import { RESPONSIVE_BREAKPOINT_XS } from '../../data/constants/Breakpoints';

const StyledHypotheticalToggleButtonContent = styled.div.attrs(
  (props: { isActive: boolean }) => props
)`
  ${tw`flex items-center gap-2`}
  background-color: rgba(13, 24, 33, 1);
  padding: 8px;
  border: 1px solid rgba(242, 201, 76, 1);
  border-radius: 8px;

  box-shadow: ${(props) =>
    props.isActive ? '0px 0px 2px 1px rgba(242, 201, 76, 0.5)' : 'none'};
  opacity: ${(props) => (props.isActive ? '1.0' : '0.5')};

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    .hypothetical-button-title {
      display: none;
    }
  }
`;

const EyeIconWrapper = styled.div`
  width: 20px;
  height: 20px;

  svg {
    width: 20px;
    height: 20px;

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
    <ToggleButton isActive={showHypothetical} setIsActive={setShowHypothetical}>
      <StyledHypotheticalToggleButtonContent isActive={showHypothetical}>
        <Text weight='bold' className='hypothetical-button-title'>
          Hypothetical
        </Text>
        <EyeIconWrapper>
          {showHypothetical ? <EyeIcon /> : <EyeOffIcon />}
        </EyeIconWrapper>
      </StyledHypotheticalToggleButtonContent>
    </ToggleButton>
  );
}
