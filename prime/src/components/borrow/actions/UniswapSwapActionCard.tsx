import { useContext, useMemo, useState } from 'react';

import Big from 'big.js';
import JSBI from 'jsbi';
import DropdownArrowDown from 'shared/lib/assets/svg/DownArrow';
import styled from 'styled-components';
import { useProvider } from 'wagmi';

import { ChainContext } from '../../../App';
import { getSwapActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { swapOperator } from '../../../data/actions/ActionOperators';
import { ActionCardProps, ActionProviders, TokenType } from '../../../data/actions/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { truncateDecimals } from '../../../util/Numbers';
import { getOutputForSwap, getUniswapPoolBasics, UniswapV3PoolBasics } from '../../../util/Uniswap';
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
  border: 1px solid rgba(26, 41, 52, 1);
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
  const { accountState, isCausingError, marginAccount, onChange, onRemove, userInputFields } = props;
  const { token0, token1 } = marginAccount;
  const { activeChain } = useContext(ChainContext);
  const [uniswapPoolBasics, setUniswapPoolBasics] = useState<UniswapV3PoolBasics | null>(null);

  let swapFromAmount = userInputFields?.at(0) ?? '';
  let swapToAmount = userInputFields?.at(1) ?? '';
  const swapFromToken = (userInputFields?.at(2) ?? TokenType.ASSET0) as TokenType;
  const swapToToken = (userInputFields?.at(3) ?? TokenType.ASSET1) as TokenType;
  const slippage = userInputFields?.at(4) ?? '0.5';
  const provider = useProvider({ chainId: activeChain.id });

  useEffectOnce(() => {
    let mounted = true;
    async function fetch() {
      const poolBasics = await getUniswapPoolBasics(marginAccount.uniswapPool, provider);
      if (mounted) {
        setUniswapPoolBasics(poolBasics);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  });

  const priceX96 = useMemo(() => {
    const sqrtPriceX96 = uniswapPoolBasics?.slot0.sqrtPriceX96;
    const sqrtPriceX96JSBI = new Big(sqrtPriceX96?.toString() || '0');
    if (sqrtPriceX96 !== undefined) {
      return sqrtPriceX96JSBI.mul(sqrtPriceX96JSBI).div(2 ** 96);
    }
    return undefined;
  }, [uniswapPoolBasics?.slot0.sqrtPriceX96]);

  if (swapFromAmount) {
    swapToAmount = getOutputForSwap(
      priceX96 || new Big(0),
      swapFromAmount || '0',
      swapFromToken === TokenType.ASSET0,
      swapFromToken === TokenType.ASSET0 ? token0.decimals : token1.decimals,
      swapFromToken === TokenType.ASSET0 ? token1.decimals : token0.decimals
    );
    swapToAmount = truncateDecimals(swapToAmount, swapToToken === TokenType.ASSET0 ? token0.decimals : token1.decimals);
  }

  function updateResult(
    swapFromAmount: string,
    swapToAmount: string,
    swapFromToken: TokenType,
    swapToToken: TokenType,
    slippage: string
  ) {
    onChange(
      {
        actionId: ActionID.SWAP,
        actionArgs: token0 !== null && token1 !== null ? getSwapActionArgs(token0, 0, token1, 0) : undefined,
        operator(operand) {
          return swapOperator(operand, TokenType.ASSET0, TokenType.ASSET1, 0, 0);
        },
      },
      [swapFromAmount, swapToAmount, swapFromToken, swapToToken, slippage]
    );
  }

  const maxFromAmount =
    swapFromToken === TokenType.ASSET0 ? accountState.assets.token0Raw : accountState.assets.token1Raw;
  const maxFromAmountString = maxFromAmount.toString();
  const maxToAmount = swapToToken === TokenType.ASSET0 ? accountState.assets.token0Raw : accountState.assets.token1Raw;
  const maxToAmountString = maxToAmount.toString();

  return (
    <BaseActionCard
      action={ActionID.SWAP}
      actionProvider={ActionProviders.UniswapV3}
      isCausingError={isCausingError}
      onRemove={onRemove}
    >
      <div className='ml-auto'>
        <Settings
          slippagePercentage={slippage}
          updateSlippagePercentage={(updatedSlippage: string) => {
            updateResult(swapFromAmount, '', swapFromToken, swapToToken, updatedSlippage);
          }}
        />
      </div>
      <TokenAmountInput
        token={swapFromToken === TokenType.ASSET0 ? token0 : token1}
        value={swapFromAmount}
        onChange={(updatedSwapFromAmount: string) => {
          updateResult(updatedSwapFromAmount, swapToAmount, swapFromToken, swapToToken, slippage);
        }}
        max={maxFromAmountString}
        maxed={swapFromAmount === maxFromAmountString}
      />
      <StyledArrowButton
        onClick={() => {
          updateResult(swapToAmount, '', swapToToken, swapFromToken, slippage);
        }}
      >
        <SVGIconWrapper width={24} height={24}>
          <DropdownArrowDown width={24} height={24} />
        </SVGIconWrapper>
      </StyledArrowButton>
      <TokenAmountInput
        token={swapToToken === TokenType.ASSET0 ? token0 : token1}
        value={swapToAmount}
        onChange={() => {}}
        max={maxToAmountString}
        maxed={swapToAmount === maxToAmountString}
      />
    </BaseActionCard>
  );
}
