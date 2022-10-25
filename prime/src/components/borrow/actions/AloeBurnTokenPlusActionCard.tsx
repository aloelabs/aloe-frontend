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
  const { marginAccount, previousActionCardState, isCausingError, onRemove, onChange } = prop;
  const { token0, token1, kitty0, kitty1 } = marginAccount;
  const fields = previousActionCardState?.textFields;

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
  const selectedToken = (fields?.at(0) ?? TokenType.KITTY0) as TokenType;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(selectedToken, dropdownOptions);

  const callbackWithFullResult = (value: string) => {
    const parsedValue = parseFloat(value) || 0;
    onChange({
      actionId: ActionID.BURN,
      actionArgs:
        value === ''
          ? undefined
          : getBurnActionArgs(
              selectedToken === TokenType.KITTY0 ? token0 : token1,
              selectedToken === TokenType.KITTY0 ? kitty0 : kitty1,
              parsedValue
            ),
      textFields: [selectedToken, value],
      aloeResult: {
        token0RawDelta: selectedToken === TokenType.KITTY0 ? parsedValue : undefined,
        token1RawDelta: selectedToken === TokenType.KITTY1 ? parsedValue : undefined,
        token0PlusDelta: selectedToken === TokenType.KITTY0 ? -parsedValue : undefined,
        token1PlusDelta: selectedToken === TokenType.KITTY1 ? -parsedValue : undefined,
        selectedToken: selectedToken,
      },
      uniswapResult: null,
      operator(operand) {
        if (!operand || selectedToken == null) return null;
        return burnOperator(operand, selectedToken, parsedValue);
      },
    });
  };

  const max = marginAccount.assets[selectedToken === TokenType.KITTY0 ? 'token0Plus' : 'token1Plus'];
  const maxString = Math.max(0, max - 1e-6).toFixed(6);
  const tokenAmount = previousActionCardState?.textFields?.at(1) ?? '';
  useEffect(() => {
    if (!previousActionCardState?.actionArgs && tokenAmount !== '') callbackWithFullResult(tokenAmount);
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
              onChange({
                actionId: ActionID.BURN,
                aloeResult: null,
                uniswapResult: null,
                textFields: [option.value as TokenType, tokenAmount],
                operator(_) {
                  return null;
                },
              });
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
