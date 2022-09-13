import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';
import {
  ActionCardProps,
  ActionID,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  parseSelectedToken,
  TokenType,
} from '../../../data/Actions';
import { getBurnActionArgs } from '../../../connector/MarginAccountActions';
import { useEffect } from 'react';

export function AloeBurnTokenPlusActionCard(prop: ActionCardProps) {
  const { marginAccount, previousActionCardState, isCausingError, onRemove, onChange } = prop;
  const { kitty0, kitty1 } = marginAccount;

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

  const previouslySelectedToken = previousActionCardState?.aloeResult?.selectedToken || null;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(previouslySelectedToken, dropdownOptions);
  const selectedToken = parseSelectedToken(selectedTokenOption.value);

  const callbackWithFullResult = (value: string) => {
    const parsedValue = parseFloat(value) || 0;
    onChange({
      actionId: ActionID.BURN,
      actionArgs:
        value === '' ? undefined : getBurnActionArgs(selectedToken === TokenType.KITTY0 ? kitty0 : kitty1, parsedValue),
      textFields: [value],
      aloeResult: {
        token0RawDelta: selectedToken === TokenType.KITTY0 ? parsedValue : undefined,
        token1RawDelta: selectedToken === TokenType.KITTY1 ? parsedValue : undefined,
        token0PlusDelta: selectedToken === TokenType.KITTY0 ? -parsedValue : undefined,
        token1PlusDelta: selectedToken === TokenType.KITTY1 ? -parsedValue : undefined,
        selectedToken: selectedToken,
      },
      uniswapResult: null,
    });
  };

  const maxString = (marginAccount.assets[selectedToken === TokenType.KITTY0 ? 'token0Plus' : 'token1Plus'] - 1e-6).toFixed(6);
  const tokenAmount = previousActionCardState?.textFields?.at(0) ?? '';
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
          onSelect={(option) => {
            if (option.value !== selectedTokenOption.value) {
              onChange({
                actionId: ActionID.BURN,
                aloeResult: {
                  selectedToken: parseSelectedToken(option.value),
                },
                uniswapResult: null,
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
