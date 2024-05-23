import React, { ReactElement } from 'react';

import { Text } from './Typography';
import { GREY_700, GREY_900 } from '../../data/constants/Colors';
import useClickOutside from '../../hooks/UseClickOutside';
import styled from 'styled-components';

import InfoIcon from '../../assets/svg/Info';

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

const InfoButtonContainer = styled.button.attrs((props: { iconSize: 'S' | 'M' | 'L' }) => props)`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: ${(props) => ICON_GAPS[props.iconSize]}px;
  color: rgba(130, 160, 182, 1);
  border-radius: 8px;
  line-height: 30px;
  font-size: 18px;
`;

const TooltipContainer = styled.div.attrs(
  (props: {
    position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    filled?: boolean;
  }) => props
)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: absolute;
  ${(props) => {
    if (props.position.startsWith('top')) {
      return 'bottom: calc(100% + 14px);';
    } else {
      return 'top: calc(100% + 14px);';
    }
  }}
  ${(props) => {
    if (props.position.endsWith('left')) {
      return 'left: 0px;';
    } else if (props.position.endsWith('right')) {
      return 'right: 0px;';
    } else {
      return 'left: calc(50% - 120px);';
    }
  }}
  padding: 16px;
  z-index: 6;
  border-radius: 8px;
  width: 240px;
  background-color: ${(props) => (props.filled ? GREY_700 : GREY_900)};
  border: ${(props) => (props.filled ? 'none' : '1px solid rgba(43, 64, 80, 1)')};

  &:before {
    content: '';
    display: block;
    position: absolute;
    ${(props) => {
      if (props.position.startsWith('top')) {
        return props.filled ? 'bottom: -8px;' : 'bottom: -9px;';
      } else {
        return props.filled ? 'top: -8px;' : 'top: -8.9px;';
      }
    }}
    ${(props) => {
      if (props.position.endsWith('left')) {
        return 'left: 24px;';
      } else if (props.position.endsWith('right')) {
        return 'right: 24px;';
      } else {
        return 'left: calc(50% - 8px);';
      }
    }}
    width: 16px;
    height: 16px;
    transform: rotate(-45deg);
    border-radius: 0 4px 0 0;
    background-color: ${(props) => (props.filled ? GREY_700 : GREY_900)};
    border-left: ${(props) => (props.filled ? 'none' : '1px solid rgba(43, 64, 80, 1)')};
    border-bottom: ${(props) => (props.filled ? 'none' : '1px solid rgba(43, 64, 80, 1)')};
  }
`;

function InfoButton(props: {
  Icon: ReactElement;
  size: 'S' | 'M' | 'L';
  onClick: () => void;
  className?: string;
  buttonText?: string;
}) {
  const { Icon, size, onClick, className, buttonText } = props;
  return (
    <InfoButtonContainer iconSize={size} onClick={onClick} className={className}>
      {Icon}
      {buttonText && (
        <Text size={size} weight='medium' color='rgba(130, 160, 182, 1)'>
          {buttonText}
        </Text>
      )}
    </InfoButtonContainer>
  );
}

export type TooltipProps = {
  buttonSize: 'S' | 'M' | 'L';
  content: string | React.ReactNode;
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  buttonClassName?: string;
  buttonText?: string;
  title?: string;
  filled?: boolean;
};

export default function Tooltip(props: TooltipProps) {
  const { buttonSize, content, position, buttonClassName, buttonText, title, filled } = props;
  const [isOpen, setIsOpen] = React.useState(false);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  useClickOutside(tooltipRef, () => setIsOpen(false), isOpen);
  return (
    <div className='inline-block relative w-max' ref={tooltipRef}>
      {isOpen && (
        <TooltipContainer position={position} filled={filled}>
          {title && (
            <Text size='M' weight='medium' className='w-full text-left mb-2 opacity-80'>
              {title}
            </Text>
          )}
          <Text size='XS' color='rgba(236, 247, 255, 1)' className='opacity-80'>
            {content}
          </Text>
        </TooltipContainer>
      )}
      <InfoButton
        Icon={<InfoIcon width={ICON_SIZES[buttonSize]} height={ICON_SIZES[buttonSize]} />}
        size={buttonSize}
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName}
        buttonText={buttonText}
      />
    </div>
  );
}
