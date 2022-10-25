import { useEffect } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';

import { getTransferOutActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { transferOutOperator } from '../../../data/actions/ActionOperators';
import {
  ActionCardProps,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  parseSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import { TokenData } from '../../../data/TokenData';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeWithdrawActionCard(prop: ActionCardProps) {
  const { marginAccount, previousActionCardState, isCausingError, onRemove, onChange } = prop;
  const { token0, token1, kitty0, kitty1 } = marginAccount;
  const fields = previousActionCardState?.textFields;

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
  const selectedToken = (fields?.at(0) ?? TokenType.ASSET0) as TokenType;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(selectedToken, dropdownOptions);

  const tokenMap = new Map<TokenType, TokenData>();
  tokenMap.set(TokenType.ASSET0, token0);
  tokenMap.set(TokenType.ASSET1, token1);
  tokenMap.set(TokenType.KITTY0, kitty0);
  tokenMap.set(TokenType.KITTY1, kitty1);

  const callbackWithFullResult = (value: string) => {
    const parsedValue = parseFloat(value) || 0;
    onChange({
      actionId: ActionID.TRANSFER_OUT,
      actionArgs:
        selectedToken && value !== '' ? getTransferOutActionArgs(tokenMap.get(selectedToken)!, parsedValue) : undefined,
      textFields: [selectedToken, value],
      aloeResult: {
        token0RawDelta: selectedToken === TokenType.ASSET0 ? -parsedValue : undefined,
        token1RawDelta: selectedToken === TokenType.ASSET1 ? -parsedValue : undefined,
        token0PlusDelta: selectedToken === TokenType.KITTY0 ? -parsedValue : undefined,
        token1PlusDelta: selectedToken === TokenType.KITTY1 ? -parsedValue : undefined,
        selectedToken: selectedToken,
      },
      uniswapResult: null,
      operator(operand) {
        if (!operand || selectedToken == null) return null;
        return transferOutOperator(operand, selectedToken, parsedValue);
      },
    });
  };

  const tokenAmount = previousActionCardState?.textFields?.at(1) ?? '';
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
          onSelect={(option: DropdownOption) => {
            if (option.value !== selectedTokenOption.value) {
              onChange({
                actionId: ActionID.TRANSFER_OUT,
                aloeResult: null,
                uniswapResult: null,
                textFields: [option.value as TokenType, tokenAmount],
                operator(operand) {
                  return null;
                },
              });
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
