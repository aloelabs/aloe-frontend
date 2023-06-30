import { ChangeEvent, useEffect, useState } from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import tw from 'twin.macro';

import { ReactComponent as MinusIcon } from '../../../assets/svg/minus.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus.svg';

const REGULAR_BORDER_COLOR = GREY_700;
const ACTIVE_BORDER_COLOR = 'rgba(82, 182, 154, 1)';

const SteppedInputWrapper = styled.div.attrs((props: { active: boolean }) => props)`
  ${tw`flex flex-col items-center justify-center`}
  background-color: transparent;
  border: 1px solid ${(props) => (props.active ? ACTIVE_BORDER_COLOR : REGULAR_BORDER_COLOR)};
  border-radius: 8px;
  padding: 8px;
`;

const StyledInput = styled.input`
  ${tw`relative text-left flex-grow`}
  background-color: transparent;
  color: rgba(204, 223, 237, 1);
  box-sizing: border-box;
  font-family: 'ClashDisplay-Variable';
  font-weight: 400;
  font-size: 20px;
  border: none;
  outline: none;
  width: 100%;
  text-overflow: ellipsis;
  text-align: center;
  padding: 12px;
`;

const SvgButtonWrapper = styled.button`
  ${tw`flex justify-center items-center`}
  height: max-content;
  width: max-content;
  margin-top: auto;
  margin-bottom: auto;
  background-color: transparent;
  border-radius: 2px;
  svg {
    path {
      stroke: #fff;
    }
  }

  &:not(:disabled):active {
    background-color: ${GREY_700};
  }

  :disabled {
    opacity: 0.5;
  }
`;

export type SteppedInputProps = {
  value: string;
  label: string;
  token0: Token | null;
  token1: Token | null;
  isToken0Selected: boolean;
  onChange: (value: string) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
  disabled?: boolean;
};

export default function SteppedInput(props: SteppedInputProps) {
  const {
    value,
    label,
    token0,
    token1,
    isToken0Selected,
    onChange,
    onDecrement,
    onIncrement,
    decrementDisabled,
    incrementDisabled,
    disabled,
  } = props;

  const [localValue, setLocalValue] = useState('');
  const [useLocalValue, setUseLocalValue] = useState(false);
  const [active, setActive] = useState(false);

  function handleFocus() {
    setActive(true);
    setUseLocalValue(true);
  }

  function handleBlur() {
    setActive(false);
    onChange(localValue);
    setUseLocalValue(false);
  }

  useEffect(() => {
    if (localValue !== value && !useLocalValue) {
      setLocalValue(value);
    }
  }, [value, localValue, useLocalValue]);

  const token0Symbol = token0?.symbol || '';
  const token1Symbol = token1?.symbol || '';

  return (
    <SteppedInputWrapper active={active}>
      <Text size='M' weight='medium'>
        {label}
      </Text>
      <div className='flex'>
        <SvgButtonWrapper onClick={onDecrement} disabled={decrementDisabled}>
          <MinusIcon />
        </SvgButtonWrapper>
        <StyledInput
          type='text'
          value={localValue}
          placeholder='0.00'
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const output = formatNumberInput(e.target.value);
            if (output != null) {
              setLocalValue(output);
            }
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
        />
        <SvgButtonWrapper onClick={onIncrement} disabled={incrementDisabled}>
          <PlusIcon />
        </SvgButtonWrapper>
      </div>
      <Text>
        {isToken0Selected ? token1Symbol : token0Symbol} per {isToken0Selected ? token0Symbol : token1Symbol}
      </Text>
    </SteppedInputWrapper>
  );
}
