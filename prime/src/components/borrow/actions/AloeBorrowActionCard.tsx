import { useEffect } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';

import { getBorrowActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { borrowOperator } from '../../../data/actions/ActionOperators';
import {
  ActionCardProps,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import { maxBorrows } from '../../../data/BalanceSheet';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeBorrowActionCard(prop: ActionCardProps) {
  const { marginAccount, accountState, userInputFields, isCausingError, forceOutput, onRemove, onChange } = prop;
  const { token0, token1 } = marginAccount;

  const dropdownOptions: DropdownOption<TokenType>[] = [
    {
      label: token0?.symbol || '',
      value: TokenType.ASSET0,
      icon: token0?.logoURI || '',
    },
    {
      label: token1?.symbol || '',
      value: TokenType.ASSET1,
      icon: token1?.logoURI || '',
    },
  ];
  const tokenAmount = userInputFields?.at(1) ?? '';
  const selectedToken = (userInputFields?.at(0) ?? TokenType.ASSET0) as TokenType;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(selectedToken, dropdownOptions);

  const callbackWithFullResult = (token: TokenType, value: string) => {
    const tokenDecimals = token === TokenType.ASSET0 ? token0.decimals : token1.decimals;
    const parsedValue = GN.fromDecimalString(value || '0', tokenDecimals);
    let amount0 = GN.zero(token0.decimals);
    let amount1 = GN.zero(token1.decimals);
    if (token === TokenType.ASSET0) {
      amount0 = parsedValue;
    } else {
      amount1 = parsedValue;
    }

    onChange(
      {
        actionId: ActionID.BORROW,
        actionArgs: value === '' ? undefined : getBorrowActionArgs(token0, amount0, token1, amount1),
        operator(operand) {
          return borrowOperator(operand, token, parsedValue);
        },
      },
      [token, value]
    );
  };

  useEffect(() => {
    if (forceOutput) callbackWithFullResult(selectedToken, tokenAmount);
  });

  const [allowed0, allowed1] = maxBorrows(
    accountState.assets,
    accountState.liabilities,
    accountState.uniswapPositions,
    marginAccount.sqrtPriceX96,
    marginAccount.iv,
    token0.decimals,
    token1.decimals
  );
  const available0 = accountState.availableForBorrow.amount0;
  const available1 = accountState.availableForBorrow.amount1;

  const max =
    selectedTokenOption.value === TokenType.ASSET0 ? GN.min(allowed0, available0) : GN.min(allowed1, available1);
  const maxString = max.toString(GNFormat.DECIMAL);
  const maxEightyPercent = max.recklessMul(0.8);
  const maxEightyPercentString = maxEightyPercent.toString(GNFormat.DECIMAL);

  return (
    <BaseActionCard
      action={ActionID.BORROW}
      actionProvider={ActionProviders.AloeII}
      isCausingError={isCausingError}
      onRemove={onRemove}
    >
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedTokenOption}
          onSelect={(option: DropdownOption<TokenType>) => {
            if (option.value !== selectedTokenOption.value) {
              callbackWithFullResult(option.value as TokenType, '');
            }
          }}
        />
        <TokenAmountInput
          token={selectedTokenOption.value === TokenType.ASSET0 ? token0 : token1}
          value={tokenAmount}
          onChange={(value) => callbackWithFullResult(selectedToken, value)}
          max={maxString}
          maxed={tokenAmount === maxEightyPercentString}
          onMax={() => callbackWithFullResult(selectedToken, maxEightyPercentString)}
          maxButtonText='80% MAX'
        />
      </div>
    </BaseActionCard>
  );
}
