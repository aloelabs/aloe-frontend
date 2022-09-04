import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, ActionProviders, DEFAULT_ACTION_VALUE } from '../../../data/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';

export function AloeMintTokenPlusActionCard(prop: ActionCardProps) {
  const { token0, token1, previousActionCardState, onRemove, onChange } = prop;
  const dropdownOptions: DropdownOption[] = [
    {
      label: token0?.ticker || '',
      value: token0.address,
      icon: token0?.iconPath || '',
    },
    {
      label: token1?.ticker || '',
      value: token1.address,
      icon: token1?.iconPath || '',
    },
  ];
  const previouslySelectedToken = previousActionCardState?.aloeResult?.selectedTokenA;
  const selectedToken = previousActionCardState?.aloeResult?.selectedTokenA || dropdownOptions[0];
  useEffectOnce(() => {
    if (!previouslySelectedToken) {
      onChange({
        aloeResult: {
          token0RawDelta: {
            numericValue: previousActionCardState?.aloeResult?.token0RawDelta?.numericValue || 0,
            inputValue: previousActionCardState?.aloeResult?.token0RawDelta?.inputValue || '',
          },
          token1RawDelta: {
            numericValue: previousActionCardState?.aloeResult?.token1RawDelta?.numericValue || 0,
            inputValue: previousActionCardState?.aloeResult?.token1RawDelta?.inputValue || '',
          },
          token0DebtDelta: DEFAULT_ACTION_VALUE,
          token1DebtDelta: DEFAULT_ACTION_VALUE,
          token0PlusDelta: {
            numericValue: previousActionCardState?.aloeResult?.token0PlusDelta?.numericValue || 0,
            inputValue: previousActionCardState?.aloeResult?.token0PlusDelta?.inputValue || '',
          },
          token1PlusDelta: {
            numericValue: previousActionCardState?.aloeResult?.token1PlusDelta?.numericValue || 0,
            inputValue: previousActionCardState?.aloeResult?.token1PlusDelta?.inputValue || '',
          },
          selectedTokenA: selectedToken,
        },
        uniswapResult: null,
      });
    }
  });
  let tokenAmount = '';
  if (previousActionCardState) {
    if (selectedToken.value === dropdownOptions[0].value) {
      tokenAmount = previousActionCardState?.aloeResult?.token0PlusDelta.inputValue || '';
    } else {
      tokenAmount = previousActionCardState?.aloeResult?.token1PlusDelta.inputValue || '';
    }
  }

  return (
    <BaseActionCard
      action={ActionProviders.AloeII.actions.DEPOSIT.name}
      actionProvider={ActionProviders.AloeII}
      onRemove={onRemove}
    >
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedToken}
          onSelect={(option) => {
            if (option?.value !== selectedToken?.value) {
              onChange({
                aloeResult: {
                  token0RawDelta: DEFAULT_ACTION_VALUE,
                  token1RawDelta: DEFAULT_ACTION_VALUE,
                  token0DebtDelta: DEFAULT_ACTION_VALUE,
                  token1DebtDelta: DEFAULT_ACTION_VALUE,
                  token0PlusDelta: DEFAULT_ACTION_VALUE,
                  token1PlusDelta: DEFAULT_ACTION_VALUE,
                  selectedTokenA: option,
                },
                uniswapResult: null,
              });
            }
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedToken?.label || ''}
          value={tokenAmount}
          onChange={(value) => {
            const token0Change =
              selectedToken?.value === token0.address
                ? parseFloat(value) || null
                : null;
            const token1Change =
              selectedToken?.value === token1.address
                ? parseFloat(value) || null
                : null;
            const token0IsSelected = selectedToken?.value === token0.address;
            onChange({
              aloeResult: {
                token0RawDelta: {
                  numericValue: token0Change != null ? (-1 * token0Change) : 0,
                  inputValue: token0IsSelected ? value : '',
                },
                token1RawDelta: {
                  numericValue: token1Change != null ? (-1 * token1Change) : 0,
                  inputValue: !token0IsSelected ? value : '',
                },
                token0DebtDelta: DEFAULT_ACTION_VALUE,
                token1DebtDelta: DEFAULT_ACTION_VALUE,
                token0PlusDelta: {
                  numericValue: token0Change != null ? token0Change : 0,
                  inputValue: token0IsSelected ? value : '',
                },
                token1PlusDelta: {
                  numericValue: token1Change != null ? token1Change : 0,
                  inputValue: !token0IsSelected ? value : '',
                },
                selectedTokenA: selectedToken,
              },
              uniswapResult: null,
              
            });
          }}
          max='100'
          maxed={tokenAmount === '100'}
        />
      </div>
    </BaseActionCard>
  );
}
