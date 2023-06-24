import { ChangeEvent } from 'react';

import { DropdownOption } from 'shared/lib/components/common/Dropdown';
import { BaseMaxButton, InputBase } from 'shared/lib/components/common/Input';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { TokenType } from '../../data/actions/Actions';
import TokenDropdown from './TokenDropdown';

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
  right: 7px;
`;

export type TokenAmountSelectInputProps = {
  options: DropdownOption<TokenType>[];
  selectedOption: DropdownOption<TokenType>;
  inputValue: string;
  maxAmount?: string;
  maxAmountLabel?: string;
  maxButtonLabel?: string;
  onMax?: () => void;
  onChange: (updatedValue: string) => void;
  onSelect: (option: DropdownOption<TokenType>) => void;
};

export default function TokenAmountSelectInput(props: TokenAmountSelectInputProps) {
  const { options, selectedOption, inputValue, maxAmount, maxAmountLabel, maxButtonLabel, onMax, onChange, onSelect } =
    props;

  return (
    <div>
      {maxAmount && (
        <div className='w-full flex justify-between items-center mb-2'>
          <Text size='XS' weight='medium' color='rgba(75, 105, 128,1)'>
            {maxAmountLabel || 'Balance'}: {maxAmount}
          </Text>
          <BaseMaxButton
            onClick={() => {
              if (onMax) {
                onMax();
                return;
              }
              onChange(maxAmount);
            }}
          >
            {maxButtonLabel || 'MAX'}
          </BaseMaxButton>
        </div>
      )}
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
    </div>
  );
}
