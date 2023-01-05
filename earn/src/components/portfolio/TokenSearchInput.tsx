import React, { createRef, useEffect, useState } from 'react';

import { DropdownOption } from 'shared/lib/components/common/Dropdown';
import { SquareInputWithIcon } from 'shared/lib/components/common/Input';
import styled from 'styled-components';

import { ReactComponent as SearchIcon } from '../../assets/svg/search.svg';
import { Token } from '../../data/Token';

const SearchInputContainer = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const SearchInputDropdownContainer = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background-color: rgba(13, 23, 30, 1);
  border: 1px solid rgba(26, 41, 52, 1);
  border-radius: 8px;
  z-index: 1;
  overflow: hidden;
`;

const SearchInputDropdownOption = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  height: 48px;
  padding: 0 16px;
  cursor: pointer;

  &:hover,
  &.selected {
    background-color: rgba(26, 41, 52, 0.5);
  }
`;

export type TokenSearchInputProps = {
  autoFocus?: boolean;
  options: DropdownOption<Token>[];
  onOptionSelected: (option: DropdownOption<Token>) => void;
};

export default function TokenSearchInput(props: TokenSearchInputProps) {
  const { autoFocus, options, onOptionSelected } = props;
  const [searchText, setSearchText] = useState('');
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(-1);
  const inputRef = createRef<HTMLInputElement>();
  const [matchingOptions, setMatchingOptions] = useState<DropdownOption<Token>[]>([]);

  useEffect(() => {
    if (inputRef.current && autoFocus) {
      inputRef.current.focus();
    }
  }, [autoFocus, inputRef]);

  useEffect(() => {
    if (searchText.length > 0) {
      const matchingOptions = options.filter((option) => option.label.toLowerCase().includes(searchText.toLowerCase()));
      setMatchingOptions(matchingOptions);
    } else {
      setMatchingOptions([]);
    }
  }, [options, searchText]);

  return (
    <SearchInputContainer>
      <SquareInputWithIcon
        innerRef={inputRef}
        value={searchText}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setSearchText(e.target.value);
          setSelectedOptionIndex(-1);
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (matchingOptions.length > 0 && selectedOptionIndex < matchingOptions.length - 1) {
              setSelectedOptionIndex((selectedOptionIndex) => selectedOptionIndex + 1);
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (matchingOptions.length > 0 && selectedOptionIndex > 0) {
              setSelectedOptionIndex((selectedOptionIndex) => selectedOptionIndex - 1);
            }
          }
        }}
        onEnter={() => {
          if (selectedOptionIndex >= 0) {
            onOptionSelected(matchingOptions[selectedOptionIndex]);
          }
        }}
        Icon={<SearchIcon />}
        size='L'
        svgColorType='stroke'
        leadingIcon={true}
        fullWidth={true}
        placeholder='Search for an asset or enter a command'
      />
      {matchingOptions.length > 0 && (
        <SearchInputDropdownContainer>
          {matchingOptions.map((option, index) => (
            <SearchInputDropdownOption
              onClick={() => onOptionSelected(option)}
              key={index}
              className={index === selectedOptionIndex ? 'selected' : ''}
            >
              {option.label}
            </SearchInputDropdownOption>
          ))}
        </SearchInputDropdownContainer>
      )}
    </SearchInputContainer>
  );
}
