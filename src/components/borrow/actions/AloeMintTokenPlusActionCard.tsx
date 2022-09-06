import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, ActionID, ActionProviders, getDropdownOptionFromSelectedToken, parseSelectedToken, SelectedToken } from '../../../data/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';

export function AloeMintTokenPlusActionCard(prop: ActionCardProps) {
  const { token0, token1, previousActionCardState, onRemove, onChange } = prop;
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
  ];
  const previouslySelectedToken = previousActionCardState?.aloeResult?.selectedToken || null;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(previouslySelectedToken, dropdownOptions);
  const selectedToken = parseSelectedToken(selectedTokenOption.value);
  useEffectOnce(() => {
    if (!previouslySelectedToken) {
      onChange({
        actionId: ActionID.MINT,
        aloeResult: {
          token0RawDelta: previousActionCardState?.aloeResult?.token0RawDelta,
          token1RawDelta: previousActionCardState?.aloeResult?.token1RawDelta,
          token0DebtDelta: previousActionCardState?.aloeResult?.token0DebtDelta,
          token1DebtDelta: previousActionCardState?.aloeResult?.token1DebtDelta,
          token0PlusDelta: previousActionCardState?.aloeResult?.token0PlusDelta,
          token1PlusDelta: previousActionCardState?.aloeResult?.token1PlusDelta,
          selectedToken: selectedToken,
        },
        uniswapResult: null,
      });
    }
  });

  let tokenAmount = previousActionCardState?.textFields ? previousActionCardState.textFields[0] : '';

  return (
    <BaseActionCard
      action={ActionID.MINT}
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
                actionId: ActionID.MINT,
                aloeResult: {
                  selectedToken: parseSelectedToken(option.value),
                },
                uniswapResult: null,
              });
            }
          }}
        />
        <TokenAmountInput
          tokenLabel={selectedTokenOption.label || ''}
          value={tokenAmount}
          onChange={(value) => {
            const parsedValue = parseFloat(value);
            onChange({
              actionId: ActionID.MINT,
              textFields: [value],
              aloeResult: {
                token0RawDelta: selectedToken === SelectedToken.TOKEN_ZERO ? -parsedValue : undefined,
                token1RawDelta: selectedToken === SelectedToken.TOKEN_ONE ? -parsedValue : undefined,
                token0PlusDelta: selectedToken === SelectedToken.TOKEN_ZERO ? parsedValue : undefined,
                token1PlusDelta: selectedToken === SelectedToken.TOKEN_ONE ? parsedValue : undefined,
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
