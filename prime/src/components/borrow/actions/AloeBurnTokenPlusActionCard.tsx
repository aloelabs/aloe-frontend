import { useEffect } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';

import { getBurnActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { burnOperator } from '../../../data/actions/ActionOperators';
import {
  ActionCardProps,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeBurnTokenPlusActionCard(prop: ActionCardProps) {
  const { marginAccount, accountState, userInputFields, isCausingError, forceOutput, onRemove, onChange } = prop;
  const { token0, token1, kitty0, kitty1 } = marginAccount;

  const dropdownOptions: DropdownOption[] = [
    {
      label: kitty0?.ticker || '',
      value: TokenType.KITTY0,
      icon: kitty0?.iconPath || '',
    },
    {
      label: kitty1?.ticker || '',
      value: TokenType.KITTY1,
      icon: kitty1?.iconPath || '',
    },
  ];
  const tokenAmount = userInputFields?.at(1) ?? '';
  const selectedToken = (userInputFields?.at(0) ?? TokenType.KITTY0) as TokenType;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(selectedToken, dropdownOptions);

  const max = accountState.assets[selectedToken === TokenType.KITTY0 ? 'token0Plus' : 'token1Plus'];
  const maxString = Math.max(0, max - 1e-6).toFixed(6);

  const callbackWithFullResult = (token: TokenType, value: string) => {
    const parsedValue = parseFloat(value) || 0;
    onChange(
      {
        actionId: ActionID.BURN,
        actionArgs:
          value === ''
            ? undefined
            : getBurnActionArgs(
                token === TokenType.KITTY0 ? token0 : token1,
                token === TokenType.KITTY0 ? kitty0 : kitty1,
                parsedValue
              ),
        operator(operand) {
          return burnOperator(operand, token, parsedValue);
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
      action={ActionID.BURN}
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
        />
      </div>
    </BaseActionCard>
  );
}
