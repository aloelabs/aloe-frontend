import React from 'react';
import { FeeTier } from '../../../data/BlendPoolMarkers';
import { TokenData } from '../../../data/TokenData';
import { FilledGreyButton } from '../../common/Buttons';
import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { ActionCardProps, ActionProvider, Actions, BaseActionCard } from '../ActionCard';

export function AloeDepositAction(prop: ActionCardProps) {
  const { token0, token1, onRemove, onChange } = prop;
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
    <BaseActionCard action='Deposit' actionProvider={Actions.AloeII} onRemove={onRemove}>
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
            const token0Change = selectedToken?.value === token0?.address ? parseFloat(value) : 0;
            const token1Change = selectedToken?.value === token1?.address ? parseFloat(value) : 0;
            onChange({
              token0Change: token0Change,
              token1Change: token1Change,
              uniswapLiquidityChange: 0,
              uniswapLowerBoundChange: 0,
              uniswapUpperBoundChange: 0,
            });
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
  const { token0, token1, onRemove, onChange } = prop;
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
    <BaseActionCard action='Withdraw' actionProvider={Actions.AloeII} onRemove={onRemove}>
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedToken}
          onSelect={(option) => {
            if (option?.value !== selectedToken?.value) {
              setTokenAmount('');
            }
            setSelectedToken(option);
            onChange({
              token0Change: 0,
              token1Change: 0,
              uniswapLiquidityChange: 0,
              uniswapLowerBoundChange: 0,
              uniswapUpperBoundChange: 0,
            });
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedToken?.label || ''}
          value={tokenAmount}
          onChange={(value) => {
            setTokenAmount(value);
            const token0Change = selectedToken?.value === token0?.address ? (-1.0 * parseFloat(value) || 0) : 0;
            const token1Change = selectedToken?.value === token1?.address ? (-1.0 * parseFloat(value) || 0) : 0;
            onChange({
              token0Change: token0Change,
              token1Change: token1Change,
              uniswapLiquidityChange: 0,
              uniswapLowerBoundChange: 0,
              uniswapUpperBoundChange: 0,
            });
          }}
          max='100'
          maxed={tokenAmount === '100'}
        />
      </div>
    </BaseActionCard>
  )
}

