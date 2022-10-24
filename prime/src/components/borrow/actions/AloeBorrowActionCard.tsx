import { useEffect, useState } from 'react';

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
import { runWithChecks } from '../../../data/actions/Utils';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeBorrowActionCard(prop: ActionCardProps<any>) {
  const { marginAccount, operand, fields, onRemove, onChange } = prop;
  const { token0, token1 } = marginAccount;

  const [isCausingError, setIsCausingError] = useState(false);

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
  const selectedTokenOption = getDropdownOptionFromSelectedToken(fields?.at(0) ?? null, dropdownOptions);
  const selectedToken = selectedTokenOption.value as TokenType;

  const callbackWithFullResult = (token: TokenType, amountStr: string) => {
    const amount = parseFloat(amountStr) || 0;
    const updatedOperand = runWithChecks(marginAccount, borrowOperator, operand, token, amount);

    onChange({
      updatedOperand,
      fields: [token, amountStr],
      actionArgs: getBorrowActionArgs(
        token0,
        token === TokenType.ASSET0 ? amount : 0,
        token1,
        token === TokenType.ASSET0 ? 0 : amount
      ),
    });

    setIsCausingError(updatedOperand === undefined);
  };

  const amountStr = fields?.at(1) ?? '';

  return (
    <BaseActionCard
      id={ActionID.BORROW}
      actionProvider={ActionProviders.AloeII}
      isCausingError={operand === undefined || isCausingError}
      onRemove={onRemove}
    >
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedTokenOption}
          onSelect={(option) => {
            if (option.value !== selectedTokenOption.value) {
              callbackWithFullResult(option.value as TokenType, amountStr);
            }
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedTokenOption.label || ''}
          value={amountStr}
          onChange={(value) => callbackWithFullResult(selectedToken, value)}
        />
      </div>
    </BaseActionCard>
  );
}
