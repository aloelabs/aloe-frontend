import JSBI from 'jsbi';
import styled from 'styled-components';
import { ReactComponent as ArrowDownIcon } from '../../../assets/svg/down_arrow.svg';
import { getSwapActionArgs } from '../../../connector/MarginAccountActions';
import {
  ActionCardProps,
  ActionID,
  ActionProviders,
  getDropdownOptionFromSelectedToken,
  parseSelectedToken,
  TokenType,
} from '../../../data/Actions';
import { Dropdown, DropdownOption } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { Text } from '../../common/Typography';
import { BaseActionCard } from '../BaseActionCard';
import Settings from '../uniswap/Settings';

//TOOD: merge this with the existing UniswapPosition?
export type UniswapV3LiquidityPosition = {
  amount0: number;
  amount1: number;
  tickLower: number;
  tickUpper: number;
  liquidity: JSBI;
};

const SVGIconWrapper = styled.div.attrs((props: { width: number; height: number }) => props)`
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  svg {
    path {
      stroke: white;
    }
  }
`;

export default function UniswapSwapActionCard(props: ActionCardProps) {
  const { marginAccount, uniswapPositions, previousActionCardState, isCausingError, onChange, onRemove } = props;
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
  //TODO: clean this up
  const inactiveTokenOption = selectedTokenOption.value === TokenType.ASSET0 ? dropdownOptions[1] : dropdownOptions[0];

  const callbackWithFullResult = (value: string) => {
    const parsedValue = parseFloat(value) || 0;
    const input = parsedValue;
    //TODO: integrate with the actual swap action
    const predicatedOutput = input * 2;
    //TODO: make sure to include a reasonable amount of digits depending on the amount
    const predicatedOutputValue = predicatedOutput.toFixed(4);

    const amount0 = selectedToken === TokenType.ASSET0 ? input : predicatedOutput;
    const amount1 = selectedToken === TokenType.ASSET1 ? predicatedOutput : input;
    onChange({
      actionId: ActionID.SWAP,
      actionArgs: value === '' ? undefined : getSwapActionArgs(token0, amount0, token1, amount1),
      textFields: [value, predicatedOutputValue],
      aloeResult: {
        token0RawDelta: selectedToken === TokenType.ASSET0 ? amount0 : -amount0,
        token1RawDelta: selectedToken === TokenType.ASSET1 ? amount1 : -amount1,
        selectedToken: selectedToken,
      },
      uniswapResult: null,
    });
  };

  function handleUpdateSlippagePercentage(updatedSlippage: string) {
    const prevTextFields = previousActionCardState?.textFields ?? ['', '', ''];
    prevTextFields[2] = updatedSlippage;
    const numericSlippage = parseFloat(updatedSlippage) || 0;

    onChange({
      actionId: ActionID.ADD_LIQUIDITY,
      textFields: prevTextFields,
      uniswapResult: null,
      aloeResult: previousActionCardState?.aloeResult ?? null,
      slipperageTolerance: numericSlippage,
    });
  }

  const maxString = '';
  const fromTokenAmount = previousActionCardState?.textFields?.at(0) ?? '';
  const toTokenAmount = previousActionCardState?.textFields?.at(1) ?? '0.00';
  let slippagePercentage = previousActionCardState?.textFields?.[2] ?? '';

  return (
    <BaseActionCard
      action={ActionID.SWAP}
      actionProvider={ActionProviders.UniswapV3}
      isCausingError={isCausingError}
      onRemove={onRemove}
    >
      <div className='ml-auto'>
        <Settings slippagePercentage={slippagePercentage} updateSlippagePercentage={handleUpdateSlippagePercentage} />
      </div>
      <Dropdown
        options={dropdownOptions}
        selectedOption={selectedTokenOption}
        onSelect={(option: DropdownOption) => {
          if (option.value !== selectedTokenOption.value) {
            onChange({
              actionId: ActionID.SWAP,
              aloeResult: {
                selectedToken: parseSelectedToken(option.value),
              },
              uniswapResult: null,
              textFields: [],
            });
          }
        }}
      />
      <TokenAmountInput
        tokenLabel={selectedTokenOption.label || ''}
        value={fromTokenAmount}
        onChange={callbackWithFullResult}
        max={maxString}
        maxed={fromTokenAmount === maxString}
      />
      <SVGIconWrapper width={24} height={24} className='mt-4'>
        <ArrowDownIcon width={24} height={24} />
      </SVGIconWrapper>
      <div className='mt-4'>
        <Text size='L' weight='bold'>
          {toTokenAmount} {inactiveTokenOption.label}
        </Text>
      </div>
    </BaseActionCard>
  );
}
