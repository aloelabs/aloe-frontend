import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, ActionID, ActionProviders, getDropdownOptionFromSelectedToken, parseSelectedToken, TokenType } from '../../../data/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { getRepayActionArgs } from '../../../connector/MarginAccountActions';

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
  useEffectOnce(() => {
    if (!previouslySelectedToken) {
      onChange({
        actionId: ActionID.REPAY,
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
  
  const tokenAmount = previousActionCardState?.textFields ? previousActionCardState.textFields[0] : '';
  const maxString = marginAccount.liabilities[selectedToken === TokenType.ASSET0 ? 'amount0' : 'amount1'].toFixed(6);
  
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
          }}
          max={maxString}
          maxed={tokenAmount === maxString}
        />
      </div>
    </BaseActionCard>
  );
}
