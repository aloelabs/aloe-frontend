import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, ActionProviders, DEFAULT_ACTION_VALUE, getDropdownOptionFromSelectedToken, parseSelectedToken, SelectedToken } from '../../../data/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';

export function AloeWithdrawActionCard(prop: ActionCardProps) {
  const { token0, token1, previousActionCardState, onRemove, onChange } = prop;
  //TODO: Temporary until these are finised, then we can just fetch the entire token
  const token0PlusAddress = token0.address + '1';
  const token1PlusAddress = token1.address + '1';
  const dropdownOptions: DropdownOption[] = [
    {
      label: token0?.ticker || '',
      value: SelectedToken.TOKEN_ZERO,
      icon: token0?.iconPath || '',
    },
    {
      label: token1?.ticker || '',
      value: SelectedToken.TOKEN_ONE,
      icon: token1?.iconPath || '',
    },
    //TODO: TEMPORARY, add type for token+
    {
      label: token0?.ticker + '+' || '',
      value: SelectedToken.TOKEN_ZERO_PLUS,
      icon: token0?.iconPath || '',
    },
    //TODO: TEMPORARY, add type for token+
    {
      label: token1?.ticker + '+' || '',
      value: SelectedToken.TOKEN_ONE_PLUS,
      icon: token1?.iconPath || '',
    }
  ];
  const previouslySelectedToken = previousActionCardState?.aloeResult?.selectedToken || null;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(previouslySelectedToken, dropdownOptions);
  const selectedToken = parseSelectedToken(selectedTokenOption.value);
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
          selectedToken: selectedToken,
        },
        uniswapResult: null,
      });
    }
  });
  let tokenAmount = '';
  if (previousActionCardState) {
    if (selectedTokenOption.value === dropdownOptions[0].value) {
      tokenAmount = previousActionCardState?.aloeResult?.token0RawDelta.inputValue || '';
    } else if (selectedTokenOption.value === dropdownOptions[1].value) {
      tokenAmount = previousActionCardState?.aloeResult?.token1RawDelta.inputValue || '';
    } else if (selectedTokenOption.value === dropdownOptions[2].value) {
      tokenAmount = previousActionCardState?.aloeResult?.token0PlusDelta.inputValue || '';
    } else if (selectedTokenOption.value === dropdownOptions[3].value) {
      tokenAmount = previousActionCardState?.aloeResult?.token1PlusDelta.inputValue || '';
    }
  }
  
  return (
    <BaseActionCard
      action={ActionProviders.AloeII.actions.WITHDRAW.name}
      actionProvider={ActionProviders.AloeII}
      onRemove={onRemove}
    >
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedTokenOption}
          onSelect={(option) => {
            if (option.value !== selectedTokenOption.value) {
              onChange({
                aloeResult: {
                  token0RawDelta: DEFAULT_ACTION_VALUE,
                  token1RawDelta: DEFAULT_ACTION_VALUE,
                  token0DebtDelta: DEFAULT_ACTION_VALUE,
                  token1DebtDelta: DEFAULT_ACTION_VALUE,
                  token0PlusDelta: DEFAULT_ACTION_VALUE,
                  token1PlusDelta: DEFAULT_ACTION_VALUE,
                  selectedToken: parseSelectedToken(option.value),
                },
                uniswapResult: null,
              });
            }
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedTokenOption.label}
          value={tokenAmount}
          onChange={(value) => {
            const token0Change =
              selectedToken === SelectedToken.TOKEN_ZERO
                ? parseFloat(value) || null
                : null;
            const token1Change =
              selectedToken === SelectedToken.TOKEN_ONE
                ? parseFloat(value) || null
                : null;
            const token0PlusChange =
              //TODO: TEMPORARY, add type for token+
              selectedToken === SelectedToken.TOKEN_ZERO_PLUS
                ? parseFloat(value) || null
                : null;
            const token1PlusChange =
              //TODO: TEMPORARY, add type for token+
              selectedToken === SelectedToken.TOKEN_ONE_PLUS
                ? parseFloat(value) || null
                : null;
            onChange({
              aloeResult: {
                token0RawDelta: {
                  numericValue: token0Change != null ? (-1 * token0Change) : 0,
                  inputValue: selectedToken === SelectedToken.TOKEN_ZERO ? value : '',
                },
                token1RawDelta: {
                  numericValue: token1Change != null ? (-1 * token1Change) : 0,
                  inputValue: selectedToken === SelectedToken.TOKEN_ONE ? value : '',
                },
                token0DebtDelta: DEFAULT_ACTION_VALUE,
                token1DebtDelta: DEFAULT_ACTION_VALUE,
                token0PlusDelta: {
                  numericValue: token0PlusChange != null ? (-1 * token0PlusChange) : 0,
                  //TODO: TEMPORARY, add type for token+
                  inputValue: selectedToken === SelectedToken.TOKEN_ZERO_PLUS ? value : '',
                },
                token1PlusDelta: {
                  numericValue: token1PlusChange != null ? (-1 * token1PlusChange) : 0,
                  //TODO: TEMPORARY, add type for token+
                  inputValue: selectedToken === SelectedToken.TOKEN_ONE_PLUS ? value : '',
                },
                selectedToken: selectedToken,
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
