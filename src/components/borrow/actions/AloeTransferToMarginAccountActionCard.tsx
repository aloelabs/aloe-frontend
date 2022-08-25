import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, Actions } from '../../../data/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';

export function AloeTransferToMarginAccountActionCard(prop: ActionCardProps) {
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
    //TODO: TEMPORARY, add type for token+
    {
      label: token0?.ticker + '+' || '',
      value: token0?.address + '1' || '',
      icon: token0?.iconPath || '',
    },
    //TODO: TEMPORARY, add type for token+
    {
      label: token1?.ticker + '+' || '',
      value: token1?.address + '1' || '',
      icon: token1?.iconPath || '',
    }
  ];
  const previouslySelectedToken = previousActionCardState?.selectedTokenA;
  const selectedToken = previousActionCardState?.selectedTokenA || dropdownOptions[0];
  useEffectOnce(() => {
    if (!previouslySelectedToken) {
      onChange({
        token0DebtDelta: {
          numericValue: previousActionCardState?.token0DebtDelta?.numericValue || 0,
          inputValue: previousActionCardState?.token0DebtDelta?.inputValue || '',
        },
        token1DebtDelta: {
          numericValue: previousActionCardState?.token1DebtDelta?.numericValue || 0,
          inputValue: previousActionCardState?.token1DebtDelta?.inputValue || '',
        },
        token0RawDelta: {
          numericValue: previousActionCardState?.token0RawDelta?.numericValue || 0,
          inputValue: previousActionCardState?.token0RawDelta?.inputValue || '',
        },
        token1RawDelta: {
          numericValue: previousActionCardState?.token1RawDelta?.numericValue || 0,
          inputValue: previousActionCardState?.token1RawDelta?.inputValue || '',
        },
        token0PlusDelta: {
          numericValue: previousActionCardState?.token0PlusDelta?.numericValue || 0,
          inputValue: previousActionCardState?.token0PlusDelta?.inputValue || '',
        },
        token1PlusDelta: {
          numericValue: previousActionCardState?.token1PlusDelta?.numericValue || 0,
          inputValue: previousActionCardState?.token1PlusDelta?.inputValue || '',
        },
        uniswapPositions: [],
        selectedTokenA: selectedToken,
        selectedTokenB: null,
      });
    }
  });
  let tokenAmount = '';
  if (previousActionCardState) {
    if (selectedToken.value === dropdownOptions[0].value) {
      tokenAmount = previousActionCardState.token0RawDelta.inputValue;
    } else if (selectedToken.value === dropdownOptions[1].value) {
      tokenAmount = previousActionCardState.token1RawDelta.inputValue;
    } else if (selectedToken.value === dropdownOptions[2].value) {
      tokenAmount = previousActionCardState.token0PlusDelta.inputValue;
    } else if (selectedToken.value === dropdownOptions[3].value) {
      tokenAmount = previousActionCardState.token1PlusDelta.inputValue;
    }
  }
  
  return (
    <BaseActionCard
      action={Actions.AloeII.actions.TRANSFER_TO_MARGIN_ACCOUNT.name}
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
                token0RawDelta: {
                  numericValue: 0,
                  inputValue: '',
                },
                token1RawDelta: {
                  numericValue: 0,
                  inputValue: '',
                },
                token0DebtDelta: {
                  numericValue: 0,
                  inputValue: '',
                },
                token1DebtDelta: {
                  numericValue: 0,
                  inputValue: '',
                },
                token0PlusDelta: {
                  numericValue: 0,
                  inputValue: '',
                },
                token1PlusDelta: {
                  numericValue: 0,
                  inputValue: '',
                },
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
            const token0PlusChange =
              //TODO: TEMPORARY, add type for token+
              selectedToken?.value === token0?.address + '1'
                ? parseFloat(value) || null
                : null;
            const token1PlusChange =
              //TODO: TEMPORARY, add type for token+
              selectedToken?.value === token1?.address + '1'
                ? parseFloat(value) || null
                : null;
            onChange({
              token0RawDelta: {
                numericValue: token0Change != null ? token0Change : 0,
                inputValue: selectedToken?.value === token0?.address ? value : '',
              },
              token1RawDelta: {
                numericValue: token1Change != null ? token1Change : 0,
                inputValue: selectedToken?.value === token1?.address ? value : '',
              },
              token0DebtDelta: {
                numericValue: 0,
                inputValue: '',
              },
              token1DebtDelta: {
                numericValue: 0,
                inputValue: '',
              },
              token0PlusDelta: {
                numericValue: token0PlusChange != null ? token0PlusChange : 0,
                //TODO: TEMPORARY, add type for token+
                inputValue: selectedToken?.value === token0?.address + '1' ? value : '',
              },
              token1PlusDelta: {
                numericValue: token1PlusChange != null ? token1PlusChange : 0,
                //TODO: TEMPORARY, add type for token+
                inputValue: selectedToken?.value === token1?.address + '1' ? value : '',
              },
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
