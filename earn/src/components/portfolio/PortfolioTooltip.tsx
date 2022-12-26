import React from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

import { ReactComponent as CloseModalIcon } from '../../assets/svg/close_modal.svg';

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
  &:before {
    content: '';
    display: block;
    position: absolute;
    top: 26px;
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
  position: relative;
  width: 100%;
`;

const CloseButton = styled.button`
  position: absolute;
  top: -12px;
  right: -12px;
`;

export type PortfolioTooltipProps = {
  content: string | React.ReactNode;
  isOpen: boolean;
  filled?: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export default function PortfolioTooltip(props: PortfolioTooltipProps) {
  const { content, isOpen, filled, setIsOpen } = props;
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
