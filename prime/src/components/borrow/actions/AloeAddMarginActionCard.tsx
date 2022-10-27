import { useEffect } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';

import { getTransferInActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { transferInOperator } from '../../../data/actions/ActionOperators';
import {
  ActionCardProps,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import { TokenData } from '../../../data/TokenData';
import { getBalanceFor } from '../../../data/UserBalances';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeAddMarginActionCard(prop: ActionCardProps) {
  const { marginAccount, availableBalances, previousActionCardState, isCausingError, onRemove, onChange } = prop;
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
      actionId: ActionID.TRANSFER_IN,
      actionArgs:
        selectedToken && value !== '' ? getTransferInActionArgs(tokenMap.get(selectedToken)!, parsedValue) : undefined,
      textFields: [selectedToken, value],
      aloeResult: {
        token0RawDelta: selectedToken === TokenType.ASSET0 ? parsedValue : undefined,
        token1RawDelta: selectedToken === TokenType.ASSET1 ? parsedValue : undefined,
        token0PlusDelta: selectedToken === TokenType.KITTY0 ? parsedValue : undefined,
        token1PlusDelta: selectedToken === TokenType.KITTY1 ? parsedValue : undefined,
        selectedToken: selectedToken,
      },
      uniswapResult: null,
      operator(operand) {
        if (!operand || selectedToken == null) return null;
        return transferInOperator(operand, selectedToken, parsedValue);
      },
    });
  };

  const max = selectedToken ? getBalanceFor(selectedToken, availableBalances) : 0;
  const maxString = Math.max(0, max - 1e-6).toFixed(6);
  const tokenAmount = previousActionCardState?.textFields?.at(1) ?? '';
  useEffect(() => {
    if (!previousActionCardState?.actionArgs && tokenAmount !== '') callbackWithFullResult(tokenAmount);
  });

  return (
    <BaseActionCard
      action={ActionID.TRANSFER_IN}
      actionProvider={ActionProviders.AloeII}
      isCausingError={isCausingError}
      onRemove={onRemove}
      // tooltipContent={
      //   <Text>
      //     Lorem ipsum dolor sit amet, consectetur adipisicing elit. Modi omnis quos facere provident, sapiente vero
      //     voluptas reiciendis esse eos iusto et accusamus molestias dolorem! Qui dignissimos in provident ullam
      //     voluptas?
      //   </Text>
      // } TODO
    >
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedTokenOption}
          onSelect={(option: DropdownOption) => {
            if (option.value !== selectedTokenOption.value) {
              onChange({
                actionId: ActionID.TRANSFER_IN,
                aloeResult: null,
                uniswapResult: null,
                textFields: [option.value as TokenType, ''],
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
