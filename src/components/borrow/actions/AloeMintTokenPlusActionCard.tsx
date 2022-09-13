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
import { getMintActionArgs } from '../../../connector/MarginAccountActions';
import { useEffect } from 'react';

export function AloeMintTokenPlusActionCard(prop: ActionCardProps) {
  const { marginAccount, previousActionCardState, isCausingError, onRemove, onChange } = prop;
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
  const previouslySelectedToken = previousActionCardState?.aloeResult?.selectedToken || null;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(previouslySelectedToken, dropdownOptions);
  const selectedToken = parseSelectedToken(selectedTokenOption.value);

  const callbackWithFullResult = (value: string) => {
    const parsedValue = parseFloat(value) || 0;
    onChange({
      actionId: ActionID.MINT,
      actionArgs:
        value === ''
          ? undefined
          : getMintActionArgs(
              selectedToken === TokenType.ASSET0 ? token0 : token1,
              selectedToken === TokenType.ASSET0 ? kitty0 : kitty1,
              parsedValue
            ),
      textFields: [value],
      aloeResult: {
        token0RawDelta: selectedToken === TokenType.ASSET0 ? -parsedValue : undefined,
        token1RawDelta: selectedToken === TokenType.ASSET1 ? -parsedValue : undefined,
        token0PlusDelta: selectedToken === TokenType.ASSET0 ? parsedValue : undefined,
        token1PlusDelta: selectedToken === TokenType.ASSET1 ? parsedValue : undefined,
        selectedToken: selectedToken,
      },
      uniswapResult: null,
    });
  };

  const maxString = (marginAccount.assets[selectedToken === TokenType.ASSET0 ? 'token0Raw' : 'token1Raw'] - 1e-6).toFixed(6);
  const tokenAmount = previousActionCardState?.textFields?.at(0) ?? '';
  useEffect(() => {
    if (!previousActionCardState?.actionArgs && tokenAmount !== '') callbackWithFullResult(tokenAmount);
  });

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
          onSelect={(option) => {
            if (option.value !== selectedTokenOption.value) {
              onChange({
                actionId: ActionID.MINT,
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
