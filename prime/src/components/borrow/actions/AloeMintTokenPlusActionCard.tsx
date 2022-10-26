import { useEffect } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';

import { getMintActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { mintOperator } from '../../../data/actions/ActionOperators';
import {
  ActionCardProps,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeMintTokenPlusActionCard(prop: ActionCardProps) {
  const { marginAccount, accountState, userInputFields, isCausingError, isOutputStale, onRemove, onChange } = prop;
  const { token0, token1, kitty0, kitty1 } = marginAccount;

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
    onChange(
      {
        actionId: ActionID.MINT,
        actionArgs:
          value === ''
            ? undefined
            : getMintActionArgs(
                selectedToken === TokenType.ASSET0 ? token0 : token1,
                selectedToken === TokenType.ASSET0 ? kitty0 : kitty1,
                parsedValue
              ),
        operator(operand) {
          if (selectedToken == null) return null;
          return mintOperator(operand, selectedToken, parsedValue);
        },
      },
      [selectedToken, value]
    );
  };

  const max = accountState.assets[selectedToken === TokenType.ASSET0 ? 'token0Raw' : 'token1Raw'];
  const maxString = Math.max(0, max - 1e-6).toFixed(6);
  const tokenAmount = userInputFields?.at(1) ?? '';
  useEffect(() => {
    if (isOutputStale) callbackWithFullResult(tokenAmount);
  }, [isOutputStale]);

  return (
    <BaseActionCard
      action={ActionID.MINT}
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
                  actionId: ActionID.MINT,
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
          max={maxString}
          maxed={tokenAmount === maxString}
        />
      </div>
    </BaseActionCard>
  );
}
