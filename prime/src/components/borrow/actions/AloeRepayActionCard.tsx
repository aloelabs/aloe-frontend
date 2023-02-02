import { useEffect } from 'react';

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
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeRepayActionCard(prop: ActionCardProps) {
  const { marginAccount, accountState, userInputFields, isCausingError, forceOutput, onRemove, onChange } = prop;
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

  const assetMax = accountState.assets[selectedToken === TokenType.ASSET0 ? 'token0Raw' : 'token1Raw'];
  const liabilityMax = accountState.liabilities[selectedToken === TokenType.ASSET0 ? 'amount0' : 'amount1'];
  const maxString = Math.max(0, Math.min(assetMax, liabilityMax) - 1e-6).toFixed(6);

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
        actionId: ActionID.REPAY,
        actionArgs: value === '' ? undefined : getRepayActionArgs(token0, amount0, token1, amount1),
        operator(operand) {
          return repayOperator(operand, selectedToken, Math.max(amount0, amount1));
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
      action={ActionID.REPAY}
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
              callbackWithFullResult(option.value, '');
            }
          }}
        />
        <TokenAmountInput
          token={selectedTokenOption.value === TokenType.ASSET0 ? token0 : token1}
          value={tokenAmount}
          onChange={(value) => callbackWithFullResult(selectedToken, value)}
          max={maxString}
          maxed={tokenAmount === maxString}
        />
      </div>
    </BaseActionCard>
  );
}
