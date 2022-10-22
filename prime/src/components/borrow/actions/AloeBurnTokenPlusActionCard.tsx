import { useEffect, useState } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';

import { getBurnActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { burnOperator } from '../../../data/actions/ActionOperators';
import {
  ActionCardProps,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  parseSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import { runWithChecks } from '../../../data/actions/Utils';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeBurnTokenPlusActionCard(prop: ActionCardProps<any>) {
  const { marginAccount, operand, fields, onRemove, onChange, onChange2 } = prop;
  const { token0, token1, kitty0, kitty1 } = marginAccount;

  const [isCausingError, setIsCausingError] = useState(false);

  const dropdownOptions: DropdownOption[] = [
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

  const callbackWithFullResult = (value: string) => {
    if (!(selectedToken && operand)) return;

    const parsedValue = parseFloat(value) || 0;
    const updatedOperand = runWithChecks(marginAccount, burnOperator, operand, selectedToken, parsedValue);

    onChange2({
      updatedOperand,
      fields: [value],
      actionArgs: getBurnActionArgs(
        selectedToken === TokenType.KITTY0 ? token0 : token1,
        selectedToken === TokenType.KITTY0 ? kitty0 : kitty1,
        parsedValue
      ),
    });

    setIsCausingError(updatedOperand === undefined);
  };

  const max = operand?.assets[selectedToken === TokenType.KITTY0 ? 'token0Plus' : 'token1Plus'] ?? 0;
  const maxString = Math.max(0, max - 1e-6).toFixed(6);
  const tokenAmount = fields?.textFields?.at(0) ?? '';
  useEffect(() => {
    if (!fields?.actionArgs && tokenAmount !== '') callbackWithFullResult(tokenAmount);
  });

  return (
    <BaseActionCard
      action={ActionID.BURN}
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
                actionId: ActionID.BURN,
                aloeResult: { selectedToken: parseSelectedToken(option.value) },
                uniswapResult: null,
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
