import React, { useEffect, useRef, useState } from 'react';

import { DropdownOption } from 'shared/lib/components/common/Dropdown';
import { SquareInputWithIcon } from 'shared/lib/components/common/Input';
import { GREY_800 } from 'shared/lib/data/constants/Colors';
import { Token } from 'shared/lib/data/Token';
import styled from 'styled-components';

import { ReactComponent as SearchIcon } from '../../assets/svg/search.svg';

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
  background-color: ${GREY_800};
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
`;

const TokenIcon = styled.img`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: white;
`;

export type TokenSearchInputProps = {
  autoFocus?: boolean;
  options: DropdownOption<Token>[];
  onOptionSelected: (option: DropdownOption<Token>) => void;
};

export default function TokenSearchInput(props: TokenSearchInputProps) {
  const { autoFocus, options, onOptionSelected } = props;
  const [searchText, setSearchText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
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
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
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
            <SearchInputDropdownOption onClick={() => onOptionSelected(option)} key={index}>
              <TokenIcon src={option.value.logoURI} className='mr-2' />
              {option.label}
            </SearchInputDropdownOption>
          ))}
        </SearchInputDropdownContainer>
      )}
    </SearchInputContainer>
  );
}
