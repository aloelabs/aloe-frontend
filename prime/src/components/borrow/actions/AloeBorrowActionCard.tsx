import { useEffect } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';

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
  const { marketInfo, marginAccount, accountState, userInputFields, isCausingError, forceOutput, onRemove, onChange } =
    prop;
  const { token0, token1 } = marginAccount;

  const dropdownOptions: DropdownOption<TokenType>[] = [
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
  const tokenAmount = userInputFields?.at(1) ?? '';
  const selectedToken = (userInputFields?.at(0) ?? TokenType.ASSET0) as TokenType;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(selectedToken, dropdownOptions);

  const callbackWithFullResult = (token: TokenType, value: string) => {
    const parsedValue = parseFloat(value) || 0;
    let amount0 = 0;
    let amount1 = 0;
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
          return borrowOperator(operand, token, Math.max(amount0, amount1));
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
  const available0 = marketInfo.lender0AvailableAssets.div(10 ** marginAccount.token0.decimals).toNumber();
  const available1 = marketInfo.lender1AvailableAssets.div(10 ** marginAccount.token1.decimals).toNumber();

  const max =
    selectedTokenOption.value === TokenType.ASSET0 ? Math.min(allowed0, available0) : Math.min(allowed1, available1);
  const maxString = Math.max(0, max - 1e-6).toFixed(6);

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
          maxed={tokenAmount === maxString}
        />
      </div>
    </BaseActionCard>
  );
}
