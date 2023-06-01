import { useEffect } from 'react';

import { DropdownOption } from 'shared/lib/components/common/Dropdown';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';

import { getTransferInActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { transferInOperator } from '../../../data/actions/ActionOperators';
import {
  ActionCardProps,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import { getBalanceFor } from '../../../data/Balances';
import { BaseActionCard } from '../BaseActionCard';
import TokenAmountSelectInput from '../TokenAmountSelectInput';

export function AloeAddMarginActionCard(prop: ActionCardProps) {
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
  const selectedTokenDecimals = selectedToken === TokenType.ASSET0 ? token0.decimals : token1.decimals;

  const max = selectedToken
    ? getBalanceFor(selectedToken, accountState.availableForDeposit)
    : GN.zero(selectedTokenDecimals);
  const maxString = max.toString(GNFormat.DECIMAL);

  const tokenMap = new Map<TokenType, Token>();
  tokenMap.set(TokenType.ASSET0, token0);
  tokenMap.set(TokenType.ASSET1, token1);

  const callbackWithFullResult = (token: TokenType, value: string) => {
    const tokenDecimals = token === TokenType.ASSET0 ? token0.decimals : token1.decimals;
    const parsedValue = GN.fromDecimalString(value || '0', tokenDecimals);
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
  });

  return (
    <BaseActionCard
      action={ActionID.TRANSFER_IN}
      actionProvider={ActionProviders.AloeII}
      isCausingError={isCausingError}
      errorMsg={errorMsg}
      onRemove={onRemove}
    >
      <TokenAmountSelectInput
        inputValue={tokenAmount}
        options={dropdownOptions}
        selectedOption={selectedTokenOption}
        maxAmount={maxString}
        onChange={(value) => callbackWithFullResult(selectedToken, value)}
        onSelect={(option: DropdownOption<TokenType>) => {
          if (option.value !== selectedTokenOption.value) {
            callbackWithFullResult(option.value, '');
          }
        }}
      />
    </BaseActionCard>
  );
}
