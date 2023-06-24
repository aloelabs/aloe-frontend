import React from 'react';

import { SquareInputWithMax } from 'shared/lib/components/common/Input';
import { Text } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { truncateDecimals } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import tw from 'twin.macro';

import ErrorIcon from '../../assets/svg/interaction_error.svg';

const INPUT_LABEL_TEXT_COLOR = 'rgba(255, 255, 255, 1)';
const BALANCE_VALUE_TEXT_COLOR = 'rgba(75, 105, 128, 1)';

const formatNumberInput = (input: string): string | null => {
  if (input === '') {
    return '';
  }

  if (input === '.') {
    return '0.';
  }

  const re = /^[0-9\b]+[.\b]?[0-9\b]{0,}$/;

  if (re.test(input)) {
    // if (max && new Big(input).gt(new Big(max))) {
    //   return max;
    // }

    return input;
  } else return null;
};

const ErrorMessageWrapper = styled.div`
  ${tw`flex items-center gap-x-2 mt-2`}
`;

const ErrorMessageText = styled.div`
  color: rgba(235, 87, 87, 1);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
`;

export type TokenAmountInputProps = {
  value: string;
  token: Token;
  onChange: (newValue: string) => void;
  //NOTE: if onMax is defined, onChange will not run when max button is clicked
  onMax?: (maxValue: string) => void;
  max?: string;
  maxed?: boolean;
  maxButtonText?: string;
  error?: boolean;
  errorMessage?: string;
  disabled?: boolean;
  onBlur?: () => void;
};

export default function TokenAmountInput(props: TokenAmountInputProps) {
  return (
    <div className='w-full'>
      <div className='flex items-center justify-between mb-2'>
        <Text size='M' weight='medium' color={INPUT_LABEL_TEXT_COLOR}>
          {props.token.symbol}
        </Text>
        {props.max !== undefined && (
          <Text size='XS' weight='medium' color={BALANCE_VALUE_TEXT_COLOR}>
            Balance: {props.max}
          </Text>
        )}
      </div>
      <SquareInputWithMax
        size='L'
        inputClassName={props.value !== '' ? 'active' : ''}
        placeholder='0.00'
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const output = formatNumberInput(event.target.value);
          if (output !== null) {
            const truncatedOutput = truncateDecimals(output, props.token.decimals);
            props.onChange(truncatedOutput);
          }
        }}
        value={props.value}
        onMaxClick={() => {
          if (props.max) {
            props.onMax ? props.onMax(props.max) : props.onChange(props.max.toString());
          }
        }}
        maxDisabled={props.maxed}
        maxHidden={props.max === undefined}
        maxButtonText={props.maxButtonText}
        fullWidth={true}
        onBlur={props?.onBlur}
        disabled={props?.disabled}
      />
      {props.error && (
        <ErrorMessageWrapper>
          <img src={ErrorIcon} width={16} height={16} alt='error' />
          <ErrorMessageText>{props.errorMessage ? props.errorMessage : 'Invalid input'}</ErrorMessageText>
        </ErrorMessageWrapper>
      )}
    </div>
  );
}
