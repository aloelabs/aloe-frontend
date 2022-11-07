import { InputBase } from 'shared/lib/components/common/Input';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { TokenData } from '../../data/TokenData';
import TokenDropdown from '../common/TokenDropdown';

export type TokenAmountInputSelectProps = {
  options: TokenData[];
  onSelect: (option: TokenData) => void;
  selectedOption: TokenData;
  inputValue: string;
  onChange: (updatedValue: string) => void;
};

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

export default function TokenAmountInputSelect(props: TokenAmountInputSelectProps) {
  const { options, onSelect, selectedOption, inputValue, onChange } = props;

  return (
    <SquareInputWrapper>
      <InputBase
        value={inputValue}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          onChange(e.target.value);
        }}
        className={inputValue !== '' ? 'active' : ''}
        inputSize='L'
        fullWidth={true}
        placeholder='0.00'
        paddingRightOverride='164px'
      />
      <TokenDropdownWrapper>
        <TokenDropdown
          options={options}
          onSelect={(option: TokenData) => {
            onSelect(option);
          }}
          selectedOption={selectedOption}
          size='S'
          backgroundColor='#4B6980'
          backgroundColorHover='#82A0B6'
          compact={true}
        />
      </TokenDropdownWrapper>
    </SquareInputWrapper>
  );
}
