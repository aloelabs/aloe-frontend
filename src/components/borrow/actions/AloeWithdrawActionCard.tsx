import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, ActionID, ActionProviders, getDropdownOptionFromSelectedToken, parseSelectedToken, TokenType } from '../../../data/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { TokenData } from '../../../data/TokenData';
import { getTransferOutActionArgs } from '../../../connector/MarginAccountActions';

export function AloeWithdrawActionCard(prop: ActionCardProps) {
  const { marginAccount, previousActionCardState, isCausingError, onRemove, onChange } = prop;
  const { token0, token1, kitty0, kitty1 } = marginAccount;
  
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
    {
      label: kitty0?.ticker || '',
      value: TokenType.KITTY0,
      icon: kitty0?.iconPath || '',
    },
    {
      label: kitty1?.ticker || '',
      value: TokenType.KITTY1,
      icon: kitty1?.iconPath || '',
    }
  ];
  const previouslySelectedToken = previousActionCardState?.aloeResult?.selectedToken || null;
  const selectedTokenOption = getDropdownOptionFromSelectedToken(previouslySelectedToken, dropdownOptions);
  const selectedToken = parseSelectedToken(selectedTokenOption.value);
  useEffectOnce(() => {
    if (!previouslySelectedToken) {
      onChange({
        actionId: ActionID.TRANSFER_OUT,
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
  const tokenMap = new Map<TokenType, TokenData>();
  tokenMap.set(TokenType.ASSET0, token0);
  tokenMap.set(TokenType.ASSET1, token1);
  tokenMap.set(TokenType.KITTY0, kitty0);
  tokenMap.set(TokenType.KITTY1, kitty1);
  
  return (
    <BaseActionCard
      action={ActionID.TRANSFER_OUT}
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
                actionId: ActionID.TRANSFER_OUT,
                aloeResult: {
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
            const parsedValue = parseFloat(value) || 0;
            onChange({
              actionId: ActionID.TRANSFER_OUT,
              actionArgs: (selectedToken && value !== '') ? getTransferOutActionArgs(tokenMap.get(selectedToken)!, parsedValue) : undefined,
              textFields: [value],
              aloeResult: {
                token0RawDelta: selectedToken === TokenType.ASSET0 ? -parsedValue : undefined,
                token1RawDelta: selectedToken === TokenType.ASSET1 ? -parsedValue : undefined,
                token0PlusDelta: selectedToken === TokenType.KITTY0 ? -parsedValue : undefined,
                token1PlusDelta: selectedToken === TokenType.KITTY1 ? -parsedValue : undefined,
                selectedToken: selectedToken,
              },
              uniswapResult: null,
            });
          }}
        />
      </div>
    </BaseActionCard>
  );
}
