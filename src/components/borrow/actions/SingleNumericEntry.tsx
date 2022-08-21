import React from 'react';
import { FeeTier } from '../../../data/BlendPoolMarkers';
import { TokenData } from '../../../data/TokenData';
import { FilledGreyButton } from '../../common/Buttons';
import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { ActionCardProps, ActionProvider, Actions, BaseActionCard } from '../ActionCard';

export type AloeDepositActionProps = {
  token0: TokenData;
  token1: TokenData;
  feeTier: FeeTier;
  onAdd: () => void;
  onRemove: () => void;
};

export function AloeDepositAction(prop: ActionCardProps) {
  const { token0, token1, feeTier, onAdd, onRemove } = prop;
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
  const [selectedToken, setSelectedToken] = React.useState<DropdownOption>(dropdownOptions[0]);
  const [tokenAmount, setTokenAmount] = React.useState<string>('');
  return (
    <BaseActionCard action='Deposit' actionProvider={Actions.AloeII} onAdd={onAdd} onRemove={onRemove}>
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedToken}
          onSelect={(option) => {
            if (option?.value !== selectedToken?.value) {
              setTokenAmount('');
            }
            setSelectedToken(option);
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedToken?.label || ''}
          value={tokenAmount}
          onChange={(value) => {
            setTokenAmount(value);
          }}
          max='100'
          maxed={tokenAmount === '100'}
        />
      </div>
    </BaseActionCard>
  )
}


export type AloeWithdrawActionProps = {
  token0: TokenData;
  token1: TokenData;
  feeTier: FeeTier;
  onAdd: () => void;
  onRemove: () => void;
};

export function AloeWithdrawAction(prop: ActionCardProps) {
  const { token0, token1, feeTier, onAdd, onRemove } = prop;
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
  const [selectedToken, setSelectedToken] = React.useState<DropdownOption>(dropdownOptions[0]);
  const [tokenAmount, setTokenAmount] = React.useState<string>('');
  return (
    <BaseActionCard action='Withdraw' actionProvider={Actions.AloeII} onAdd={onAdd} onRemove={onRemove}>
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedToken}
          onSelect={(option) => {
            if (option?.value !== selectedToken?.value) {
              setTokenAmount('');
            }
            setSelectedToken(option);
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedToken?.label || ''}
          value={tokenAmount}
          onChange={(value) => {
            setTokenAmount(value);
          }}
          max='100'
          maxed={tokenAmount === '100'}
        />
      </div>
    </BaseActionCard>
  )
}

