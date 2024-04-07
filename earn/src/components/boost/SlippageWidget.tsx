import { useRef, useState } from 'react';

import { RESPONSIVE_BREAKPOINT_XS } from 'shared/lib/data/constants/Breakpoints';
import { GREY_700, GREY_800 } from 'shared/lib/data/constants/Colors';
import useClickOutside from 'shared/lib/data/hooks/UseClickOutside';
import styled from 'styled-components';
import tw from 'twin.macro';

import { ReactComponent as GearIcon } from '../../assets/svg/gear.svg';
import MaxSlippageInput from '../common/MaxSlippageInput';

const SvgButtonWrapper = styled.button`
  ${tw`flex justify-center items-center`}
  height: max-content;
  width: max-content;
  margin-top: auto;
  margin-bottom: auto;
  background-color: transparent;
  border-radius: 8px;
  padding: 6px;
  svg {
    path {
      stroke: #fff;
    }
  }

  &:hover {
    svg {
      path {
        stroke: rgba(255, 255, 255, 0.75);
      }
    }
  }
`;

const SettingsMenuWrapper = styled.div`
  ${tw`absolute flex flex-col gap-4`}
  z-index: 6;
  background-color: ${GREY_800};
  border: 1px solid ${GREY_700};
  border-radius: 8px;
  min-width: 350px;
  padding: 16px;
  top: 42px;
  right: 0;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    min-width: 300px;
  }
`;

export type SlippageWidgetProps = {
  updateSlippagePercentage: (updatedSlippage: string) => void;
};

export default function SlippageWidget(props: SlippageWidgetProps) {
  const { updateSlippagePercentage } = props;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const settingsMenuRef = useRef(null);
  useClickOutside(settingsMenuRef, () => {
    setIsMenuOpen(false);
  });
  return (
    <div className='relative' ref={settingsMenuRef}>
      <SvgButtonWrapper
        onClick={() => {
          setIsMenuOpen(!isMenuOpen);
        }}
      >
        <GearIcon />
      </SvgButtonWrapper>
      <SettingsMenuWrapper className={isMenuOpen ? '' : 'invisible'}>
        <MaxSlippageInput updateMaxSlippage={updateSlippagePercentage} />
      </SettingsMenuWrapper>
    </div>
  );
}
