import { useEffect } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';

import { getBorrowActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { borrowOperator } from '../../../data/actions/ActionOperators';
import {
  ActionCardProps,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeBorrowActionCard(prop: ActionCardProps) {
  const { marginAccount, userInputFields, isCausingError, isOutputStale, onRemove, onChange } = prop;
  const { token0, token1 } = marginAccount;

  const dropdownOptions: DropdownOption[] = [
    {
      label: token0?.ticker || '',
      value: TokenType.ASSET0,
      icon: token0?.iconPath || '',
    },
    {
      label: token1?.ticker || '',
      value: TokenType.ASSET1,
      icon: token1?.iconPath || '',
    },
  ];
  const selectedToken = (userInputFields?.at(0) ?? TokenType.ASSET0) as TokenType;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(selectedToken, dropdownOptions);

  const callbackWithFullResult = (value: string) => {
    const parsedValue = parseFloat(value) || 0;
    let amount0 = 0;
    let amount1 = 0;
    if (selectedToken === TokenType.ASSET0) {
      amount0 = parsedValue;
    } else {
      amount1 = parsedValue;
    }

    onChange(
      {
        actionId: ActionID.BORROW,
        actionArgs: value === '' ? undefined : getBorrowActionArgs(token0, amount0, token1, amount1),
        operator(operand) {
          if (selectedToken == null) return null;
          return borrowOperator(operand, selectedToken, Math.max(amount0, amount1));
        },
      },
      [selectedToken, value]
    );
  };

  const tokenAmount = userInputFields?.at(1) ?? '';
  useEffect(() => {
    if (isOutputStale) callbackWithFullResult(tokenAmount);
  }, [isOutputStale]);

  return (
    <BaseActionCard
      action={ActionID.BORROW}
      actionProvider={ActionProviders.AloeII}
      isCausingError={isCausingError}
      onRemove={onRemove}
    >
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedTokenOption}
          onSelect={(option: DropdownOption) => {
            if (option.value !== selectedTokenOption.value) {
              onChange(
                {
                  actionId: ActionID.BORROW,
                  operator(operand) {
                    return null;
                  },
                },
                [option.value as TokenType, tokenAmount]
              );
            }
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedTokenOption.label || ''}
          value={tokenAmount}
          onChange={callbackWithFullResult}
        />
      </div>
    </BaseActionCard>
  );
}
