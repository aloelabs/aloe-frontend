import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, ActionID, ActionProviders, getDropdownOptionFromSelectedToken, parseSelectedToken, SelectedToken } from '../../../data/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { getTransferInActionArgs } from '../../../connector/MarginAccountActions';
import { TokenData } from '../../../data/TokenData';
import { Text } from '../../common/Typography';

export function AloeAddMarginActionCard(prop: ActionCardProps) {
  const { token0, token1, kitty0, kitty1, previousActionCardState, isCausingError, onRemove, onChange } = prop;

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
    {
      label: kitty0?.ticker || '',
      value: SelectedToken.TOKEN_ZERO_PLUS,
      icon: kitty0?.iconPath || '',
    },
    {
      label: kitty1?.ticker || '',
      value: SelectedToken.TOKEN_ONE_PLUS,
      icon: kitty1?.iconPath || '',
    }
  ];
  const previouslySelectedToken = previousActionCardState?.aloeResult?.selectedToken || null;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(previouslySelectedToken, dropdownOptions);
  const selectedToken = parseSelectedToken(selectedTokenOption.value);
  useEffectOnce(() => {
    if (!previouslySelectedToken) {
      onChange({
        actionId: ActionID.TRANSFER_IN,
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
  const tokenMap = new Map<SelectedToken, TokenData>();
  tokenMap.set(SelectedToken.TOKEN_ZERO, token0);
  tokenMap.set(SelectedToken.TOKEN_ONE, token1);
  tokenMap.set(SelectedToken.TOKEN_ZERO_PLUS, kitty0);
  tokenMap.set(SelectedToken.TOKEN_ONE_PLUS, kitty1);
  
  return (
    <BaseActionCard
      action={ActionID.TRANSFER_IN}
      actionProvider={ActionProviders.AloeII}
      isCausingError={isCausingError}
      onRemove={onRemove}
      tooltipContent={<Text>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Modi omnis quos facere provident, sapiente vero voluptas reiciendis esse eos iusto et accusamus molestias dolorem! Qui dignissimos in provident ullam voluptas?</Text>}
    >
      <div className='w-full flex flex-col gap-4 items-center'>
        <Dropdown
          options={dropdownOptions}
          selectedOption={selectedTokenOption}
          onSelect={(option) => {
            if (option.value !== selectedTokenOption.value) {
              onChange({
                actionId: ActionID.TRANSFER_IN,
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
            onChange({
              actionId: ActionID.TRANSFER_IN,
              actionArgs: selectedToken ? getTransferInActionArgs(tokenMap.get(selectedToken)!, parsedValue) : undefined,
              textFields: [value],
              aloeResult: {
                token0RawDelta: selectedToken === SelectedToken.TOKEN_ZERO ? parsedValue : undefined,
                token1RawDelta: selectedToken === SelectedToken.TOKEN_ONE ? parsedValue : undefined,
                token0PlusDelta: selectedToken === SelectedToken.TOKEN_ZERO_PLUS ? parsedValue : undefined,
                token1PlusDelta: selectedToken === SelectedToken.TOKEN_ONE_PLUS ? parsedValue : undefined,
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
