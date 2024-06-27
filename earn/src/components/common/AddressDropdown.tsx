import { useEffect, useRef, useState } from 'react';

import DropdownArrowDown from 'shared/lib/assets/svg/DropdownArrowDown';
import DropdownArrowUp from 'shared/lib/assets/svg/DropdownArrowUp';
import { Text } from 'shared/lib/components/common/Typography';
import { GREY_800 } from 'shared/lib/data/constants/Colors';
import styled from 'styled-components';
import { Address } from 'viem';

const DEFAULT_BACKGROUND_COLOR = GREY_800;
const DEFAULT_BACKGROUND_COLOR_HOVER = 'rgb(18, 32, 41)';
const DROPDOWN_HEADER_BORDER_COLOR = 'rgba(34, 54, 69, 1)';
const DROPDOWN_LIST_SHADOW_COLOR = 'rgba(0, 0, 0, 0.12)';
const DROPDOWN_PADDING_SIZES = {
  S: '8px 38px 8px 12px',
  M: '10px 40px 10px 16px',
  L: '12px 42px 12px 20px',
};

const DropdownWrapper = styled.div.attrs((props: { compact?: boolean }) => props)`
  display: flex;
  flex-direction: column;
  align-items: start;
  justify-content: space-evenly;
  position: relative;
  overflow: visible;
  width: ${(props) => (props.compact ? 'max-content' : '100%')};
`;

const DropdownHeader = styled.button.attrs(
  (props: { size: 'S' | 'M' | 'L'; backgroundColor?: string; compact?: boolean }) => props
)`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: ${(props) => DROPDOWN_PADDING_SIZES[props.size]};
  width: ${(props) => (props.compact ? 'max-content' : '100%')};
  background-color: ${(props) => props.backgroundColor || DEFAULT_BACKGROUND_COLOR};
  border: 1px solid ${DROPDOWN_HEADER_BORDER_COLOR};
  border-radius: 8px;
  cursor: pointer;
  &.active {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
`;

const DropdownList = styled.div.attrs((props: { backgroundColor?: string }) => props)`
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 100%;
  right: 0;
  min-width: 100%;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  z-index: 1;
  background-color: ${(props) => props.backgroundColor || DEFAULT_BACKGROUND_COLOR};
  border: 1px solid ${DROPDOWN_HEADER_BORDER_COLOR};
  border-top: 0;
  box-shadow: 0px 4px 8px ${DROPDOWN_LIST_SHADOW_COLOR};
`;

const DropdownListItem = styled.button.attrs(
  (props: { size: 'S' | 'M' | 'L'; backgroundColor?: string; backgroundColorHover?: string }) => props
)`
  text-align: start;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  white-space: nowrap;
  width: 100%;
  background-color: ${(props) => props.backgroundColor || DEFAULT_BACKGROUND_COLOR};
  padding: ${(props) => DROPDOWN_PADDING_SIZES[props.size]};
  cursor: pointer;

  &:last-child {
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }
  &:hover {
    background-color: ${(props) => props.backgroundColorHover || DEFAULT_BACKGROUND_COLOR_HOVER};
  }
`;

export type AddressDropdownProps = {
  options: Address[];
  selectedOption: Address;
  onSelect: (option: Address) => void;
  size: 'S' | 'M' | 'L';
  backgroundColor?: string;
  backgroundColorHover?: string;
  compact?: boolean;
};

export default function AddressDropdown(props: AddressDropdownProps) {
  const { options, selectedOption, onSelect, size, backgroundColor, backgroundColorHover, compact } = props;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  });

  return (
    <DropdownWrapper ref={dropdownRef} compact={compact}>
      <DropdownHeader
        onClick={() => setIsOpen(!isOpen)}
        size={size}
        backgroundColor={backgroundColor}
        compact={compact}
        className={isOpen ? 'active' : ''}
      >
        <div className='flex items-center gap-2'>
          <Text size='S' weight='medium'>
            {selectedOption}
          </Text>
        </div>
        {isOpen ? (
          <DropdownArrowUp className='w-5 absolute right-3' />
        ) : (
          <DropdownArrowDown className='w-5 absolute right-3' />
        )}
      </DropdownHeader>
      {isOpen && (
        <DropdownList backgroundColor={backgroundColor}>
          {options.map((option) => (
            <DropdownListItem
              key={option}
              onClick={() => {
                onSelect(option);
                setIsOpen(false);
              }}
              size={size}
              backgroundColor={backgroundColor}
              backgroundColorHover={backgroundColorHover}
            >
              <div className='flex items-center gap-2'>
                <Text size='S' weight='medium'>
                  {option}
                </Text>
              </div>
            </DropdownListItem>
          ))}
        </DropdownList>
      )}
    </DropdownWrapper>
  );
}
