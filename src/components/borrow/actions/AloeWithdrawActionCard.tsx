import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, ActionProviders, DEFAULT_ACTION_VALUE } from '../../../data/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';

export function AloeWithdrawActionCard(prop: ActionCardProps) {
  const { token0, token1, previousActionCardState, onRemove, onChange } = prop;
  //TODO: Temporary until these are finised, then we can just fetch the entire token
  const token0PlusAddress = token0.address + '1';
  const token1PlusAddress = token1.address + '1';
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
    //TODO: TEMPORARY, add type for token+
    {
      label: token0?.ticker + '+' || '',
      value: token0PlusAddress,
      icon: token0?.iconPath || '',
    },
    //TODO: TEMPORARY, add type for token+
    {
      label: token1?.ticker + '+' || '',
      value: token1PlusAddress,
      icon: token1?.iconPath || '',
    }
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
      tokenAmount = previousActionCardState?.aloeResult?.token0RawDelta.inputValue || '';
    } else if (selectedToken.value === dropdownOptions[1].value) {
      tokenAmount = previousActionCardState?.aloeResult?.token1RawDelta.inputValue || '';
    } else if (selectedToken.value === dropdownOptions[2].value) {
      tokenAmount = previousActionCardState?.aloeResult?.token0PlusDelta.inputValue || '';
    } else if (selectedToken.value === dropdownOptions[3].value) {
      tokenAmount = previousActionCardState?.aloeResult?.token1PlusDelta.inputValue || '';
    }
  }
  
  return (
    <BaseActionCard
      action={ActionProviders.AloeII.actions.TRANSFER_FROM_MARGIN_ACCOUNT.name}
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
            const token0PlusChange =
              //TODO: TEMPORARY, add type for token+
              selectedToken?.value === token0PlusAddress
                ? parseFloat(value) || null
                : null;
            const token1PlusChange =
              //TODO: TEMPORARY, add type for token+
              selectedToken?.value === token1PlusAddress
                ? parseFloat(value) || null
                : null;
            onChange({
              aloeResult: {
                token0RawDelta: {
                  numericValue: token0Change != null ? (-1 * token0Change) : 0,
                  inputValue: selectedToken?.value === token0.address ? value : '',
                },
                token1RawDelta: {
                  numericValue: token1Change != null ? (-1 * token1Change) : 0,
                  inputValue: selectedToken?.value === token1.address ? value : '',
                },
                token0DebtDelta: DEFAULT_ACTION_VALUE,
                token1DebtDelta: DEFAULT_ACTION_VALUE,
                token0PlusDelta: {
                  numericValue: token0PlusChange != null ? (-1 * token0PlusChange) : 0,
                  //TODO: TEMPORARY, add type for token+
                  inputValue: selectedToken?.value === token0PlusAddress ? value : '',
                },
                token1PlusDelta: {
                  numericValue: token1PlusChange != null ? (-1 * token1PlusChange) : 0,
                  //TODO: TEMPORARY, add type for token+
                  inputValue: selectedToken?.value === token1PlusAddress ? value : '',
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
