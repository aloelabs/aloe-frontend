import React, { useEffect } from 'react';

import { DropdownOption } from 'shared/lib/components/common/Dropdown';
import { SquareInputWithIcon } from 'shared/lib/components/common/Input';
import styled from 'styled-components';

import { ReactComponent as SearchIcon } from '../../assets/svg/search.svg';

const SearchInputContainer = styled.div`
  position: relative;
  width: 100%;
`;

const SearchInputDropdownContainer = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background-color: rgb(13, 23, 30);
  border-radius: 8px;
  box-shadow: 0px 0px 4px 0.25px rgba(0, 0, 0, 0.1);
  z-index: 1;
`;

const SearchInputDropdownOption = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  height: 48px;
  padding: 0 16px;
  cursor: pointer;
`;

export type SearchInput = {
  options: DropdownOption[];
  onOptionSelected: (option: DropdownOption) => void;
};

export default function SearchInput(props: SearchInput) {
  const { options, onOptionSelected } = props;
  const [searchText, setSearchText] = React.useState('');
  const [matchingOptions, setMatchingOptions] = React.useState<DropdownOption[]>([]);

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
      <SearchInputDropdownContainer>
        {matchingOptions.map((option, index) => (
          <SearchInputDropdownOption onClick={() => onOptionSelected(option)} key={index}>
            {option.label}
          </SearchInputDropdownOption>
        ))}
      </SearchInputDropdownContainer>
    </SearchInputContainer>
  );
}
