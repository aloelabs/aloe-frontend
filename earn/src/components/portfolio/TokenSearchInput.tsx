import React, { useEffect, useState } from 'react';

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
`;

export type TokenSearchInputProps = {
  options: DropdownOption<Token>[];
  onOptionSelected: (option: DropdownOption<Token>) => void;
};

export default function TokenSearchInput(props: TokenSearchInputProps) {
  const { options, onOptionSelected } = props;
  const [searchText, setSearchText] = useState('');
  const [matchingOptions, setMatchingOptions] = useState<DropdownOption<Token>[]>([]);

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
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
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
              {option.label}
            </SearchInputDropdownOption>
          ))}
        </SearchInputDropdownContainer>
      )}
    </SearchInputContainer>
  );
}
