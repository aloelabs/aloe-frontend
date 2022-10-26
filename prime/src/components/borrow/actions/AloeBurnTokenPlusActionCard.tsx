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
  const selectedToken = (userInputFields?.at(0) ?? TokenType.KITTY0) as TokenType;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(selectedToken, dropdownOptions);

  const callbackWithFullResult = (value: string) => {
    const parsedValue = parseFloat(value) || 0;
    onChange(
      {
        actionId: ActionID.BURN,
        actionArgs:
          value === ''
            ? undefined
            : getBurnActionArgs(
                selectedToken === TokenType.KITTY0 ? token0 : token1,
                selectedToken === TokenType.KITTY0 ? kitty0 : kitty1,
                parsedValue
              ),
        operator(operand) {
          if (selectedToken == null) return null;
          return burnOperator(operand, selectedToken, parsedValue);
        },
      },
      [selectedToken, value]
    );
  };

  const max = accountState.assets[selectedToken === TokenType.KITTY0 ? 'token0Plus' : 'token1Plus'];
  const maxString = Math.max(0, max - 1e-6).toFixed(6);
  const tokenAmount = userInputFields?.at(1) ?? '';
  useEffect(() => {
    if (forceOutput) callbackWithFullResult(tokenAmount);
  }, [forceOutput]);

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
              onChange(
                {
                  actionId: ActionID.BURN,
                  operator(_) {
                    return null;
                  },
                },
                [option.value as TokenType, '']
              );
            }
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedTokenOption.label || ''}
          value={tokenAmount}
          onChange={callbackWithFullResult}
          max={maxString}
          maxed={tokenAmount === maxString}
        />
      </div>
    </BaseActionCard>
  );
}
