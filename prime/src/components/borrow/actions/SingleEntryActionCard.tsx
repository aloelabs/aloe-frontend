import { useState } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';

import { ActionID } from '../../../data/actions/ActionID';
import {
  ActionCardOperand,
  ActionCardProps,
  ActionProvider,
  getDropdownOptionFromSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import { runWithChecks } from '../../../data/actions/Utils';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export interface SingleEntryActionCardProps extends ActionCardProps<readonly [TokenType, string] | undefined> {
  id: ActionID;
  actionProvider: ActionProvider;
  dropdownOptions: DropdownOption[];
  maxStr?: (token: TokenType) => string;
  tooltipContent?: React.ReactNode;
  operator: (operand: ActionCardOperand, token: TokenType, amount: number) => ActionCardOperand | undefined;
  getActionArgs: (token: TokenType, amount: number) => string;
}

export function SingleEntryActionCard(prop: SingleEntryActionCardProps) {
  const {
    // ActionCardProps
    marginAccount,
    operand,
    fields,
    onRemove,
    onChange,
    // SingleEntryActionCardProps
    id,
    actionProvider,
    dropdownOptions,
    maxStr,
    tooltipContent,
    operator,
    getActionArgs,
  } = prop;
  const [isCausingError, setIsCausingError] = useState(false);

  const selectedTokenOption = getDropdownOptionFromSelectedToken(fields?.[0] ?? null, dropdownOptions);
  const selectedToken = selectedTokenOption.value as TokenType;

  const onInput = (token: TokenType, amountStr: string) => {
    const amount = parseFloat(amountStr) || 0;
    const updatedOperand = runWithChecks(marginAccount, operator, operand, token, amount);

    onChange({
      updatedOperand,
      fields: [token, amountStr],
      actionArgs: getActionArgs(token, amount),
    });

    setIsCausingError(updatedOperand === undefined);
  };

  const amountStr = fields?.at(1) ?? '';

  return (
    <BaseActionCard
      id={id}
      actionProvider={actionProvider}
      isCausingError={operand === undefined || isCausingError}
      onRemove={onRemove}
      tooltipContent={tooltipContent}
    >
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedTokenOption}
          onSelect={(option) => {
            if (option.value !== selectedTokenOption.value) {
              onInput(option.value as TokenType, amountStr);
            }
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedTokenOption.label || ''}
          value={amountStr}
          onChange={(value) => onInput(selectedToken, value)}
          // max={maxStr}
          // maxed={amountStr === maxStr}
        />
      </div>
    </BaseActionCard>
  );
}
