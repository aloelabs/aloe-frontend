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
  const { marginAccount, accountState, userInputFields, isCausingError, forceOutput, onRemove, onChange } = prop;
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
  const tokenAmount = userInputFields?.at(1) ?? '';
  const selectedToken = (userInputFields?.at(0) ?? TokenType.ASSET0) as TokenType;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(selectedToken, dropdownOptions);

  const max = selectedToken ? getBalanceFor(selectedToken, accountState.availableBalances) : 0;
  const maxString = Math.max(0, max - 1e-6).toFixed(6);

  const tokenMap = new Map<TokenType, TokenData>();
  tokenMap.set(TokenType.ASSET0, token0);
  tokenMap.set(TokenType.ASSET1, token1);
  tokenMap.set(TokenType.KITTY0, kitty0);
  tokenMap.set(TokenType.KITTY1, kitty1);

  const callbackWithFullResult = (token: TokenType, value: string) => {
    const parsedValue = parseFloat(value) || 0;
    onChange(
      {
        actionId: ActionID.TRANSFER_IN,
        actionArgs: token && value !== '' ? getTransferInActionArgs(tokenMap.get(token)!, parsedValue) : undefined,
        operator(operand) {
          return transferInOperator(operand, token, parsedValue);
        },
      },
      [token, value]
    );
  };

  useEffect(() => {
    if (forceOutput) callbackWithFullResult(selectedToken, tokenAmount);
  }, [forceOutput]);

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
