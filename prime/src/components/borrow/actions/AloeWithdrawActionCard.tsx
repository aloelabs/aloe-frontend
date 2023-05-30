import { useEffect } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';

import { getTransferOutActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { transferOutOperator } from '../../../data/actions/ActionOperators';
import {
  ActionCardProps,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import { maxWithdraws } from '../../../data/BalanceSheet';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeWithdrawActionCard(prop: ActionCardProps) {
  const { marginAccount, accountState, userInputFields, isCausingError, errorMsg, forceOutput, onRemove, onChange } =
    prop;
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

  const tokenMap = new Map<TokenType, Token>();
  tokenMap.set(TokenType.ASSET0, token0);
  tokenMap.set(TokenType.ASSET1, token1);

  const callbackWithFullResult = (token: TokenType, value: string) => {
    const tokenDecimals = token === TokenType.ASSET0 ? token0.decimals : token1.decimals;
    const parsedValue = GN.fromDecimalString(value || '0', tokenDecimals);
    onChange(
      {
        actionId: ActionID.TRANSFER_OUT,
        actionArgs: token && value !== '' ? getTransferOutActionArgs(tokenMap.get(token)!, parsedValue) : undefined,
        operator(operand) {
          return transferOutOperator(operand, token, parsedValue);
        },
      },
      [token, value]
    );
  };

  useEffect(() => {
    if (forceOutput) callbackWithFullResult(selectedToken, tokenAmount);
  });

  const [allowed0, allowed1] = maxWithdraws(
    accountState.assets,
    accountState.liabilities,
    accountState.uniswapPositions,
    marginAccount.sqrtPriceX96,
    marginAccount.iv,
    token0.decimals,
    token1.decimals
  );

  const hasOutstandingBorrows = Object.values(accountState.liabilities).some((liability) => liability.isGtZero());

  const max = selectedTokenOption.value === TokenType.ASSET0 ? allowed0 : allowed1;
  const eightyPercentMax = max.recklessMul(0.8);
  const maxString = hasOutstandingBorrows
    ? eightyPercentMax.toString(GNFormat.DECIMAL)
    : max.toString(GNFormat.DECIMAL);
  const trueMaxString = max.toString(GNFormat.DECIMAL);

  return (
    <BaseActionCard
      action={ActionID.TRANSFER_OUT}
      actionProvider={ActionProviders.AloeII}
      isCausingError={isCausingError}
      errorMsg={errorMsg}
      onRemove={onRemove}
    >
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedTokenOption}
          onSelect={(option: DropdownOption<TokenType>) => {
            if (option.value !== selectedTokenOption.value) {
              callbackWithFullResult(option.value, '');
            }
          }}
        />
        <TokenAmountInput
          token={selectedTokenOption.value === TokenType.ASSET0 ? token0 : token1}
          value={tokenAmount}
          onChange={(value) => callbackWithFullResult(selectedToken, value)}
          max={trueMaxString}
          maxed={tokenAmount === maxString}
          onMax={() => callbackWithFullResult(selectedToken, maxString)}
          maxButtonText={hasOutstandingBorrows ? '80% MAX' : undefined}
        />
      </div>
    </BaseActionCard>
  );
}
