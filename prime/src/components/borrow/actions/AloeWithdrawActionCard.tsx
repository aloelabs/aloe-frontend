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
import { TokenData } from '../../../data/TokenData';
import { getTransferOutActionArgs } from '../../../connector/MarginAccountActions';
import { useEffect } from 'react';
import { Assets } from '../../../data/MarginAccount';

export function AloeWithdrawActionCard(prop: ActionCardProps) {
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

  const tokenMap = new Map<TokenType, TokenData>();
  tokenMap.set(TokenType.ASSET0, token0);
  tokenMap.set(TokenType.ASSET1, token1);
  tokenMap.set(TokenType.KITTY0, kitty0);
  tokenMap.set(TokenType.KITTY1, kitty1);

  const callbackWithFullResult = (value: string) => {
    const parsedValue = parseFloat(value) || 0;
    const updatedAssets: Assets = {
      ...marginAccount.assets,
      token0Raw: marginAccount.assets.token0Raw - (selectedToken === TokenType.ASSET0 ? parsedValue : 0),
      token1Raw: marginAccount.assets.token1Raw - (selectedToken === TokenType.ASSET1 ? parsedValue : 0),
      token0Plus: marginAccount.assets.token0Plus - (selectedToken === TokenType.KITTY0 ? parsedValue : 0),
      token1Plus: marginAccount.assets.token1Plus - (selectedToken === TokenType.KITTY1 ? parsedValue : 0),
    };
    onChange(
      {
        actionId: ActionID.TRANSFER_OUT,
        actionArgs:
          selectedToken && value !== ''
            ? getTransferOutActionArgs(tokenMap.get(selectedToken)!, parsedValue)
            : undefined,
        textFields: [value],
        aloeResult: {
          token0RawDelta: selectedToken === TokenType.ASSET0 ? -parsedValue : undefined,
          token1RawDelta: selectedToken === TokenType.ASSET1 ? -parsedValue : undefined,
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

  const tokenAmount = previousActionCardState?.textFields?.at(0) ?? '';
  useEffect(() => {
    if (!previousActionCardState?.actionArgs && tokenAmount !== '') callbackWithFullResult(tokenAmount);
  });

  return (
    <BaseActionCard
      action={ActionID.TRANSFER_OUT}
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
                  actionId: ActionID.TRANSFER_OUT,
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
          tokenLabel={selectedTokenOption.label}
          value={tokenAmount}
          onChange={callbackWithFullResult}
        />
      </div>
    </BaseActionCard>
  );
}
