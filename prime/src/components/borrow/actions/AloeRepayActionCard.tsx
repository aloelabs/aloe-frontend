import { useEffect, useState } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';

import { getRepayActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { repayOperator } from '../../../data/actions/ActionOperators';
import {
  ActionCardProps,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import { runWithChecks } from '../../../data/actions/Utils';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeRepayActionCard(prop: ActionCardProps<any>) {
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
    const updatedOperand = runWithChecks(marginAccount, repayOperator, operand, token, amount);

    onChange({
      updatedOperand,
      fields: [token, amountStr],
      actionArgs: getRepayActionArgs(
        token0,
        token === TokenType.ASSET0 ? amount : 0,
        token1,
        token === TokenType.ASSET0 ? 0 : amount
      ),
    });

    setIsCausingError(updatedOperand === undefined);
  };

  const assetMax = operand?.assets[selectedToken === TokenType.ASSET0 ? 'token0Raw' : 'token1Raw'] ?? 0;
  const liabilityMax = operand?.liabilities[selectedToken === TokenType.ASSET0 ? 'amount0' : 'amount1'] ?? 0;
  const maxString = Math.max(0, Math.min(assetMax, liabilityMax) - 1e-6).toFixed(6);
  const amountStr = fields?.at(1) ?? '';

  return (
    <BaseActionCard
      id={ActionID.REPAY}
      actionProvider={ActionProviders.AloeII}
      isCausingError={isCausingError}
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
          max={maxString}
          maxed={amountStr === maxString}
        />
      </div>
    </BaseActionCard>
  );
}
