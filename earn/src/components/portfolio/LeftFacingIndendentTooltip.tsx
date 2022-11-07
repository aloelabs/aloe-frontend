import React from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

import { ReactComponent as CloseModalIcon } from '../../assets/svg/close_modal.svg';
import InfoIcon from '../../assets/svg/info.svg';
import useClickOutside from '../../data/hooks/UseClickOutside';

const ICON_SIZES = {
  S: 16,
  M: 20,
  L: 24,
};

const ICON_GAPS = {
  S: 8,
  M: 10,
  L: 10,
};

const InfoButton = styled.button.attrs((props: { icon: string; iconSize: 'S' | 'M' | 'L' }) => props)`
  ${tw`flex justify-center items-center`}
  gap: ${(props) => ICON_GAPS[props.iconSize]}px;
  color: rgba(130, 160, 182, 1);
  border-radius: 8px;
  line-height: 30px;
  font-size: 18px;
  &:after {
    content: '';
    display: block;
    width: ${(props) => ICON_SIZES[props.iconSize]}px;
    height: ${(props) => ICON_SIZES[props.iconSize]}px;
    background-image: url(${(props) => props.icon});
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
  }
`;

const TooltipContainer = styled.div.attrs((props: { verticallyCentered?: boolean; filled?: boolean }) => props)`
  ${tw`flex flex-col items-center justify-center absolute`}
  padding: 16px;
  z-index: 30;
  border-radius: 8px;
  width: 220px;
  background-color: ${(props) => (props.filled ? 'rgba(26, 41, 52, 1);' : 'rgba(7, 14, 18, 1);')};
  border: ${(props) => (props.filled ? 'none;' : '1px solid rgba(43, 64, 80, 1);')};
  right: -245px;
  top: 0;
  top: 50%;
  transform: translateY(-50%);
  ${(props) => {
    if (props.verticallyCentered) {
      return 'top: 50%; transform: translateY(-50%);';
    }
  }}

  &:before {
    content: '';
    display: block;
    position: absolute;
    ${(props) => {
      return props.filled ? 'top: calc(50% - 8px);' : 'top: calc(50% - 8px);';
    }}
    ${(props) => {
      return props.filled ? 'left: -8px;' : 'left: -9px;';
    }}
    width: 16px;
    height: 16px;
    transform: rotate(45deg);
    border-radius: 0 4px 0 0;
    background-color: ${(props) => (props.filled ? 'rgba(26, 41, 52, 1);' : 'rgba(7, 14, 18, 1);')};
    border-left: ${(props) => (props.filled ? 'none;' : '1px solid rgba(43, 64, 80, 1);')};
    border-bottom: ${(props) => (props.filled ? 'none;' : '1px solid rgba(43, 64, 80, 1);')};
  }
`;

const TooltipHeader = styled.div`
  /* height: 12px;
  width: 100%;
  display: flex;
  justify-content: flex-end; */
  position: relative;
  width: 100%;
`;

const CloseButton = styled.button`
  position: absolute;
  top: -12px;
  right: -12px;
`;

export type LeftFacingIndependentTooltipProps = {
  content: string | React.ReactNode;
  isOpen: boolean;
  verticallyCentered?: boolean;
  filled?: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export default function LeftFacingIndependentTooltip(props: LeftFacingIndependentTooltipProps) {
  const { content, isOpen, verticallyCentered, filled, setIsOpen } = props;
  // useClickOutside(tooltipRef, () => setIsOpen(false), isOpen);
  if (!isOpen) {
    return null;
  }
  return (
    <TooltipContainer filled={filled}>
      <TooltipHeader>
        <CloseButton onClick={() => setIsOpen(false)}>
          <CloseModalIcon width={12} height={12} />
        </CloseButton>
      </TooltipHeader>
      <Text size='XS' color='rgba(236, 247, 255, 1)' className='opacity-80'>
        {content}
      </Text>
    </TooltipContainer>
  );
}
