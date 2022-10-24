import { useEffect } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';

import { getRepayActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import {
  ActionCardProps,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  parseSelectedToken,
  TokenType,
} from '../../../data/actions/Actions';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';

export function AloeRepayActionCard(prop: ActionCardProps) {
  const { marginAccount, previousActionCardState, isCausingError, onRemove, onChange } = prop;
  const { token0, token1 } = marginAccount;

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
  const previouslySelectedToken = previousActionCardState?.aloeResult?.selectedToken || null;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(previouslySelectedToken, dropdownOptions);
  const selectedToken = parseSelectedToken(selectedTokenOption.value);

  const callbackWithFullResult = (value: string) => {
    const parsedValue = parseFloat(value) || 0;
    let amount0 = 0;
    let amount1 = 0;
    if (selectedToken === TokenType.ASSET0) {
      amount0 = parsedValue;
    } else {
      amount1 = parsedValue;
    }

    onChange({
      actionId: ActionID.REPAY,
      actionArgs: value === '' ? undefined : getRepayActionArgs(token0, amount0, token1, amount1),
      textFields: [value],
      aloeResult: {
        token0RawDelta: selectedToken === TokenType.ASSET0 ? -parsedValue : undefined,
        token1RawDelta: selectedToken === TokenType.ASSET1 ? -parsedValue : undefined,
        token0DebtDelta: selectedToken === TokenType.ASSET0 ? -parsedValue : undefined,
        token1DebtDelta: selectedToken === TokenType.ASSET1 ? -parsedValue : undefined,
        selectedToken: selectedToken,
      },
      uniswapResult: null,
    });
  };

  const assetMax = marginAccount.assets[selectedToken === TokenType.ASSET0 ? 'token0Raw' : 'token1Raw'];
  const liabilityMax = marginAccount.liabilities[selectedToken === TokenType.ASSET0 ? 'amount0' : 'amount1'];
  const maxString = Math.max(0, Math.min(assetMax, liabilityMax) - 1e-6).toFixed(6);
  const tokenAmount = previousActionCardState?.textFields?.at(0) ?? '';
  useEffect(() => {
    if (!previousActionCardState?.actionArgs && tokenAmount !== '') callbackWithFullResult(tokenAmount);
  });

  return (
    <BaseActionCard
      action={ActionID.REPAY}
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
                actionId: ActionID.REPAY,
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
