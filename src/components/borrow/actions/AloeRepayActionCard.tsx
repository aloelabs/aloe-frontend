import { useEffect, useState } from 'react';
import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, Actions } from '../../../data/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';

export function AloeRepayActionCard(prop: ActionCardProps) {
  const { token0, token1, previousActionCardState, onRemove, onChange } = prop;
  const dropdownOptions: DropdownOption[] = [
    {
      label: token0?.ticker || '',
      value: token0?.address || '',
      icon: token0?.iconPath || '',
    },
    {
      label: token1?.ticker || '',
      value: token1?.address || '',
      icon: token1?.iconPath || '',
    },
  ];
  const previouslySelectedToken = previousActionCardState?.selectedTokenA;
  useEffectOnce(() => {
    if (!previouslySelectedToken) {
      onChange({
        token0DebtDelta: previousActionCardState?.token0DebtDelta || '',
        token1DebtDelta: previousActionCardState?.token1DebtDelta || '',
        token0RawDelta: '',
        token1RawDelta: '',
        token0PlusDelta: previousActionCardState?.token0PlusDelta || '',
        token1PlusDelta: previousActionCardState?.token1PlusDelta || '',
        uniswapPositions: [],
        selectedTokenA: selectedToken,
        selectedTokenB: null,
      });
    }
  });
  const selectedToken = previousActionCardState?.selectedTokenA || dropdownOptions[0];
  let tokenAmount = '';
  if (previousActionCardState) {
    if (selectedToken.value === dropdownOptions[0].value) {
      tokenAmount = previousActionCardState.token0DebtDelta;
    } else {
      tokenAmount = previousActionCardState.token1DebtDelta;
    }
  }
  
  return (
    <BaseActionCard
      action={Actions.AloeII.actions.REPAY.name}
      actionProvider={Actions.AloeII}
      onRemove={onRemove}
    >
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedToken}
          onSelect={(option) => {
            if (option?.value !== selectedToken?.value) {
              onChange({
                token0RawDelta: '',
                token1RawDelta: '',
                token0DebtDelta: '',
                token1DebtDelta: '',
                token0PlusDelta: '',
                token1PlusDelta: '',
                uniswapPositions: [],
                selectedTokenA: option,
                selectedTokenB: null,
              });
            }
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedToken?.label || ''}
          value={tokenAmount}
          onChange={(value) => {
            const token0Change =
              selectedToken?.value === token0?.address
                ? parseFloat(value) || null
                : null;
            const token1Change =
              selectedToken?.value === token1?.address
                ? parseFloat(value) || null
                : null;
            const token0IsSelected = selectedToken?.value === token0?.address;
            onChange({
              token0RawDelta: token0IsSelected ? value : '',//Allows for decimals to be entered
              token1RawDelta: !token0IsSelected ? value : '',//Allows for decimals to be entered
              token0DebtDelta: token0IsSelected ? value : '',//Allows for decimals to be entered
              token1DebtDelta: !token0IsSelected ? value : '',//Allows for decimals to be entered
              token0PlusDelta: '',
              token1PlusDelta: '',
              uniswapPositions: [],
              selectedTokenA: selectedToken,
              selectedTokenB: null,
            });
          }}
          max='100'
          maxed={tokenAmount === '100'}
        />
      </div>
    </BaseActionCard>
  );
}
