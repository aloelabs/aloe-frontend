import JSBI from 'jsbi';
import DropdownArrowDown from 'shared/lib/assets/svg/DownArrow';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { truncateDecimals } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import { getSwapActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { swapOperator } from '../../../data/actions/ActionOperators';
import { ActionCardProps, ActionProviders, TokenType } from '../../../data/actions/Actions';
import { DEFAULT_SLIPPAGE_PERCENTAGE } from '../../../data/constants/Values';
import { getOutputForSwap } from '../../../util/Uniswap';
import TokenAmountInput from '../../common/TokenAmountInput';
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

const StyledArrowButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${GREY_700};
  border-radius: 4px;
  width: 40px;
  height: 40px;
  margin-top: 8px;

  &:hover {
    background-color: rgba(26, 41, 52, 0.5);
  }

  &:active {
    background-color: rgba(26, 41, 52, 0.8);
  }
`;

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
  const { accountState, marginAccount, userInputFields, isCausingError, errorMsg, onChange, onRemove } = props;
  const { token0, token1 } = marginAccount;

  const amountInExact = userInputFields?.at(0) ?? '';
  const amountOutMin = userInputFields?.at(1) ?? '';
  const tokenTypeIn = (userInputFields?.at(2) ?? TokenType.ASSET0) as TokenType;
  const slippage = userInputFields?.at(3) ?? '';

  const priceX96 = marginAccount.sqrtPriceX96.square();

  function updateResult(newAmountInExact: string, newTokenTypeIn: TokenType, newSlippage: string) {
    const tokenTypeInDecimals = newTokenTypeIn === TokenType.ASSET0 ? token0.decimals : token1.decimals;
    const tokenTypeOutDecimals = newTokenTypeIn === TokenType.ASSET0 ? token1.decimals : token0.decimals;

    const parsedAmountIn = GN.fromDecimalString(newAmountInExact || '0', tokenTypeInDecimals);
    let newAmountOutMin = '';
    if (newAmountInExact !== '') {
      newAmountOutMin = getOutputForSwap(
        priceX96,
        parsedAmountIn,
        newTokenTypeIn === TokenType.ASSET0,
        tokenTypeOutDecimals,
        newSlippage || DEFAULT_SLIPPAGE_PERCENTAGE
      );
      newAmountOutMin = truncateDecimals(newAmountOutMin, tokenTypeOutDecimals);
    }
    const parsedAmountOut = GN.fromDecimalString(newAmountOutMin || '0', tokenTypeOutDecimals);
    const amount0 = newTokenTypeIn === TokenType.ASSET0 ? parsedAmountIn.neg() : parsedAmountOut;
    const amount1 = newTokenTypeIn === TokenType.ASSET1 ? parsedAmountIn.neg() : parsedAmountOut;

    onChange(
      {
        actionId: ActionID.SWAP,
        actionArgs: token0 && token1 ? getSwapActionArgs(token0, amount0, token1, amount1) : undefined,
        operator(operand) {
          return swapOperator(operand, amount0, amount1);
        },
      },
      [newAmountInExact, newAmountOutMin, newTokenTypeIn, newSlippage]
    );
  }

  const maxFromAmount =
    tokenTypeIn === TokenType.ASSET0 ? accountState.assets.token0Raw : accountState.assets.token1Raw;
  const maxFromAmountString = maxFromAmount.toString(GNFormat.DECIMAL);

  return (
    <BaseActionCard
      action={ActionID.SWAP}
      actionProvider={ActionProviders.UniswapV3}
      isCausingError={isCausingError}
      errorMsg={errorMsg}
      onRemove={onRemove}
    >
      <div className='ml-auto'>
        <Settings
          slippagePercentage={slippage}
          updateSlippagePercentage={(updatedSlippage: string) => {
            updateResult(amountInExact, tokenTypeIn, updatedSlippage);
          }}
        />
      </div>
      <TokenAmountInput
        token={tokenTypeIn === TokenType.ASSET0 ? token0 : token1}
        value={amountInExact}
        onChange={(updatedSwapFromAmount: string) => {
          updateResult(updatedSwapFromAmount, tokenTypeIn, slippage);
        }}
        max={maxFromAmountString}
        maxed={amountInExact === maxFromAmountString}
      />
      <StyledArrowButton
        onClick={() => {
          updateResult(amountOutMin, tokenTypeIn === TokenType.ASSET0 ? TokenType.ASSET1 : TokenType.ASSET0, slippage);
        }}
      >
        <SVGIconWrapper width={24} height={24}>
          <DropdownArrowDown width={24} height={24} />
        </SVGIconWrapper>
      </StyledArrowButton>
      <TokenAmountInput
        token={tokenTypeIn === TokenType.ASSET0 ? token1 : token0}
        value={amountOutMin}
        onChange={() => {}}
      />
    </BaseActionCard>
  );
}
