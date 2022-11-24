import { ChangeEvent } from 'react';

import { InputBase } from 'shared/lib/components/common/Input';
import styled from 'styled-components';

import { Token } from '../../data/Token';
import TokenDropdown from '../common/TokenDropdown';

const SquareInputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  border-radius: 8px;
  input {
    border-radius: 8px;
  }
  width: 100%;
`;

const TokenDropdownWrapper = styled.div`
  position: absolute;
  top: 7px;
  right: 7px;
`;

export type TokenAmountSelectInputProps = {
  options: Token[];
  onSelect: (option: Token) => void;
  selectedOption: Token;
  inputValue: string;
  onChange: (updatedValue: string) => void;
};

export default function TokenAmountSelectInput(props: TokenAmountSelectInputProps) {
  const { options, onSelect, selectedOption, inputValue, onChange } = props;

  return (
    <SquareInputWrapper>
      <InputBase
        value={inputValue}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className={inputValue !== '' ? 'active' : ''}
        inputSize='L'
        fullWidth={true}
        placeholder='0.00'
        paddingRightOverride='164px'
      />
      <TokenDropdownWrapper>
        <TokenDropdown
          options={options}
          onSelect={onSelect}
          selectedOption={selectedOption}
          size='S'
          backgroundColor='rgba(43, 64, 80, 1)'
          backgroundColorHover='rgb(75, 105, 128)'
          compact={true}
        />
      </TokenDropdownWrapper>
    </SquareInputWrapper>
  );
}
