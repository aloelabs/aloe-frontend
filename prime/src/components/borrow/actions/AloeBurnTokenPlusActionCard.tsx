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
import { Assets } from '../../../data/MarginAccount';

export function AloeBurnTokenPlusActionCard(prop: ActionCardProps) {
  const { marginAccount, previousActionCardState, isCausingError, onRemove, onChange } = prop;
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

  const previouslySelectedToken = previousActionCardState?.aloeResult?.selectedToken || null;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(previouslySelectedToken, dropdownOptions);
  const selectedToken = parseSelectedToken(selectedTokenOption.value);

  const callbackWithFullResult = (value: string) => {
    const parsedValue = parseFloat(value) || 0;
    const updatedAssets: Assets = {
      ...marginAccount.assets,
      token0Raw: marginAccount.assets.token0Raw + (selectedToken === TokenType.KITTY0 ? parsedValue : 0),
      token1Raw: marginAccount.assets.token1Raw + (selectedToken === TokenType.KITTY1 ? parsedValue : 0),
      token0Plus: marginAccount.assets.token0Plus - (selectedToken === TokenType.KITTY0 ? parsedValue : 0),
      token1Plus: marginAccount.assets.token1Plus - (selectedToken === TokenType.KITTY1 ? parsedValue : 0),
    };
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
        textFields: [value],
        aloeResult: {
          token0RawDelta: selectedToken === TokenType.KITTY0 ? parsedValue : undefined,
          token1RawDelta: selectedToken === TokenType.KITTY1 ? parsedValue : undefined,
          token0PlusDelta: selectedToken === TokenType.KITTY0 ? -parsedValue : undefined,
          token1PlusDelta: selectedToken === TokenType.KITTY1 ? -parsedValue : undefined,
          selectedToken: selectedToken,
        },
        uniswapResult: null,
      },
      {
        ...marginAccount,
        assets: updatedAssets,
      }
    );
  };

  const max = marginAccount.assets[selectedToken === TokenType.KITTY0 ? 'token0Plus' : 'token1Plus'];
  const maxString = Math.max(0, max - 1e-6).toFixed(6);
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
              onChange(
                {
                  actionId: ActionID.BURN,
                  aloeResult: {
                    selectedToken: parseSelectedToken(option.value),
                  },
                  uniswapResult: null,
                },
                marginAccount
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
