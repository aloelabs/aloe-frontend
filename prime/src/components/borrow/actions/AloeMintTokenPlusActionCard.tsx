import { useEffect, useState } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';

import { getMintActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { mintOperator } from '../../../data/actions/ActionOperators';
import {
  ActionCardProps,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import { runWithChecks } from '../../../data/actions/Utils';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeMintTokenPlusActionCard(prop: ActionCardProps<any>) {
  const { marginAccount, operand, fields, onRemove, onChange } = prop;
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
  ];
  const selectedTokenOption = getDropdownOptionFromSelectedToken(fields?.at(0) ?? null, dropdownOptions);
  const selectedToken = selectedTokenOption.value as TokenType;

  const callbackWithFullResult = (token: TokenType, amountStr: string) => {
    const amount = parseFloat(amountStr) || 0;
    const updatedOperand = runWithChecks(marginAccount, mintOperator, operand, token, amount);

    onChange({
      updatedOperand,
      fields: [token, amountStr],
      actionArgs: getMintActionArgs(
        token === TokenType.ASSET0 ? token0 : token1,
        token === TokenType.ASSET0 ? kitty0 : kitty1,
        amount
      ),
    });

    setIsCausingError(updatedOperand === undefined);
  };

  const max = operand?.assets[selectedToken === TokenType.ASSET0 ? 'token0Raw' : 'token1Raw'] ?? 0;
  const maxString = Math.max(0, max - 1e-6).toFixed(6);
  const amountStr = fields?.at(1) ?? '';

  return (
    <BaseActionCard
      id={ActionID.MINT}
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
