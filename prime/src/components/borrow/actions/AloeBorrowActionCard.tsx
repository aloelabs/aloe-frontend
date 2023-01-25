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
  const { marginAccount, userInputFields, isCausingError, forceOutput, onRemove, onChange } = prop;
  const { token0, token1 } = marginAccount;

  const dropdownOptions: DropdownOption<TokenType>[] = [
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
  const tokenAmount = userInputFields?.at(1) ?? '';
  const selectedToken = (userInputFields?.at(0) ?? TokenType.ASSET0) as TokenType;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(selectedToken, dropdownOptions);

  const asset0TotalSupply = marginAccount.lender0TotalSupply;
  const asset1TotalSupply = marginAccount.lender1TotalSupply;
  const asset0Utilization = marginAccount.lender0Utilization;
  const asset1Utilization = marginAccount.lender1Utilization;
  const asset0Available = asset0TotalSupply - asset0TotalSupply * (asset0Utilization / 100);
  const asset1Available = asset1TotalSupply - asset1TotalSupply * (asset1Utilization / 100);
  const max = selectedToken === TokenType.ASSET0 ? asset0Available : asset1Available;
  const maxString = max.toString();

  const callbackWithFullResult = (token: TokenType, value: string) => {
    const parsedValue = parseFloat(value) || 0;
    let amount0 = 0;
    let amount1 = 0;
    if (token === TokenType.ASSET0) {
      amount0 = parsedValue;
    } else {
      amount1 = parsedValue;
    }

    onChange(
      {
        actionId: ActionID.BORROW,
        actionArgs: value === '' ? undefined : getBorrowActionArgs(token0, amount0, token1, amount1),
        operator(operand) {
          return borrowOperator(operand, token, Math.max(amount0, amount1));
        },
      },
      [token, value]
    );
  };

  useEffect(() => {
    if (forceOutput) callbackWithFullResult(selectedToken, tokenAmount);
  });

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
          onSelect={(option: DropdownOption<TokenType>) => {
            if (option.value !== selectedTokenOption.value) {
              callbackWithFullResult(option.value as TokenType, '');
            }
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedTokenOption.label || ''}
          value={tokenAmount}
          onChange={(value) => callbackWithFullResult(selectedToken, value)}
          max={maxString}
          maxed={tokenAmount === maxString}
          maxLabel='Total Supply'
        />
      </div>
    </BaseActionCard>
  );
}
