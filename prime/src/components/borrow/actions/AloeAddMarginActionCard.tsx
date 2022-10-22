import { useEffect, useState } from 'react';

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
import { runWithChecks } from '../../../data/actions/Utils';
import { TokenData } from '../../../data/TokenData';
import { getBalanceFor } from '../../../data/UserBalances';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeAddMarginActionCard(prop: ActionCardProps<any>) {
  const { marginAccount, operand, fields, onRemove, onChange2 } = prop;
  const { token0, token1, kitty0, kitty1 } = marginAccount;

  const [isCausingError, setIsCausingError] = useState(false);

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
  const selectedTokenOption = getDropdownOptionFromSelectedToken(fields?.at(0) ?? null, dropdownOptions);
  const selectedToken = selectedTokenOption.value as TokenType;

  const tokenMap = new Map<TokenType, TokenData>();
  tokenMap.set(TokenType.ASSET0, token0);
  tokenMap.set(TokenType.ASSET1, token1);
  tokenMap.set(TokenType.KITTY0, kitty0);
  tokenMap.set(TokenType.KITTY1, kitty1);

  const callbackWithFullResult = (token: TokenType, amountStr: string) => {
    const amount = parseFloat(amountStr) || 0;
    const updatedOperand = runWithChecks(marginAccount, transferInOperator, operand, token, amount);

    onChange2({
      updatedOperand,
      fields: [token, amountStr],
      actionArgs: getTransferInActionArgs(tokenMap.get(token)!, amount),
    });

    setIsCausingError(updatedOperand === undefined);
  };

  const max = operand ? getBalanceFor(selectedToken, operand.availableBalances) : 0;
  const maxString = Math.max(0, max - 1e-6).toFixed(6);
  const amountStr = fields?.at(1) ?? '';

  return (
    <BaseActionCard
      action={ActionID.TRANSFER_IN}
      actionProvider={ActionProviders.AloeII}
      isCausingError={operand === undefined || isCausingError}
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
          onSelect={(option) => {
            if (option.value !== selectedTokenOption.value) {
              callbackWithFullResult(option.value as TokenType, amountStr);
            }
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedTokenOption.label || ''}
          value={amountStr}
          onChange={(value) => callbackWithFullResult(selectedToken, value)}
          max={maxString}
          maxed={amountStr === maxString}
        />
      </div>
    </BaseActionCard>
  );
}
