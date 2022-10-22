import { useEffect, useState } from 'react';

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
import { runWithChecks } from '../../../data/actions/Utils';
import { TokenData } from '../../../data/TokenData';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeWithdrawActionCard(prop: ActionCardProps<any>) {
  const { marginAccount, operand, fields, onRemove, onChange, onChange2 } = prop;
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
  const previouslySelectedToken = fields?.aloeResult?.selectedToken || null;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(previouslySelectedToken, dropdownOptions);
  const selectedToken = parseSelectedToken(selectedTokenOption.value);

  const tokenMap = new Map<TokenType, TokenData>();
  tokenMap.set(TokenType.ASSET0, token0);
  tokenMap.set(TokenType.ASSET1, token1);
  tokenMap.set(TokenType.KITTY0, kitty0);
  tokenMap.set(TokenType.KITTY1, kitty1);

  const callbackWithFullResult = (value: string) => {
    if (!(selectedToken && operand)) return;

    const parsedValue = parseFloat(value) || 0;
    const updatedOperand = runWithChecks(marginAccount, transferOutOperator, operand, selectedToken, parsedValue);

    onChange2({
      updatedOperand,
      fields: [value],
      actionArgs: getTransferOutActionArgs(tokenMap.get(selectedToken)!, parsedValue),
    });

    setIsCausingError(updatedOperand === undefined);
  };

  const tokenAmount = fields?.textFields?.at(0) ?? '';
  useEffect(() => {
    if (!fields?.actionArgs && tokenAmount !== '') callbackWithFullResult(tokenAmount);
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
              onChange({
                actionId: ActionID.TRANSFER_OUT,
                aloeResult: { selectedToken: parseSelectedToken(option.value) },
                uniswapResult: null,
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
