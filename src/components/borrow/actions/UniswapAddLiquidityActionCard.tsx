import { useEffect, useState } from 'react';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, ActionID, ActionProviders } from '../../../data/Actions';
import SteppedInput from '../uniswap/SteppedInput';
import LiquidityChart, {
  ChartEntry,
} from '../uniswap/LiquidityChart';
import TokenAmountInput from '../../common/TokenAmountInput';
import TokenChooser from '../../common/TokenChooser';
import Settings from '../uniswap/Settings';
import { calculateAmount0FromAmount1, calculateAmount1FromAmount0, calculateTickData, calculateTickInfo, getPoolAddressFromTokens, getUniswapPoolBasics, priceToTick, shouldAmount0InputBeDisabled, shouldAmount1InputBeDisabled, TickData, TickInfo, tickToPrice, UniswapV3PoolBasics } from '../../../util/Uniswap';
import { useProvider } from 'wagmi';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { formatNumberInput, roundDownToNearestN, roundUpToNearestN } from '../../../util/Numbers';
import { LiquidityChartPlaceholder } from '../uniswap/LiquidityChartPlaceholder';
import { TickMath } from '@uniswap/v3-sdk';
import Big from 'big.js';
import JSBI from 'jsbi';

const MIN_TICK = TickMath.MIN_TICK;
const MAX_TICK = TickMath.MAX_TICK;

type TickPrice = {
  price: string;
  tick: number;
};

export default function UniswapAddLiquidityActionCard(props: ActionCardProps) {
  const { token0, token1, feeTier, previousActionCardState, isCausingError, onChange, onRemove } = props;

  const isToken0Selected = previousActionCardState?.uniswapResult?.isToken0Selected || false;

  const [localIsAmount0LastUpdated, setLocalIsAmount0LastUpdated] = useState(false);
  const [localToken0Amount, setLocalToken0Amount] = useState('');
  const [localToken1Amount, setLocalToken1Amount] = useState('');
  const [localLiquidityJSBI, setLocalLiquidityJSBI] = useState(JSBI.BigInt(0));
  const [uniswapPoolBasics, setUniswapPoolBasics] = useState<UniswapV3PoolBasics | null>(null);
  const [tickInfo, setTickInfo] = useState<TickInfo | null>(null);
  const [isLiquidityDataLoading, setIsLiquidityDataLoading] = useState(true);
  const [liquidityData, setLiquidityData] = useState<TickData[]>([]);
  const [chartData, setChartData] = useState<ChartEntry[]>([]);

  const provider = useProvider();

  const poolAddress = getPoolAddressFromTokens(token0, token1, feeTier);

  useEffectOnce(() => {
    let mounted = true;
    if (poolAddress == null) return;
    async function fetch(poolAddress: string) {
      const poolBasics = await getUniswapPoolBasics(poolAddress, provider);
      if (mounted) {
        setUniswapPoolBasics(poolBasics);
      }
      const tickData = await calculateTickData(poolAddress, poolBasics);
      if (mounted) {
        setLiquidityData(tickData);
        setIsLiquidityDataLoading(false);
      }
    }
    fetch(poolAddress);
    return () => {
      mounted = false;
    };
  });

  useEffectOnce(() => {
    if (!previousActionCardState?.uniswapResult) return;
    if (previousActionCardState.uniswapResult.isToken0Selected) {
      //only update if we need to
      setLocalIsAmount0LastUpdated(true);
    }
  });

  useEffect(() => {
    if (isLiquidityDataLoading) return;
    let updatedChartData: ChartEntry[] = [];
    if (isToken0Selected) {
      updatedChartData = liquidityData.map((td: TickData) => {
        return {
          price: td.price0In1,
          liquidityDensity: td.totalValueIn0,
        };
      });
    } else {
      const reversedLiquidityData = [...liquidityData].reverse();
      updatedChartData = reversedLiquidityData.map((td: TickData) => {
        return {
          price: td.price1In0,
          liquidityDensity: td.totalValueIn0,
        };
      });
    }
    setChartData(updatedChartData);
  }, [isLiquidityDataLoading, isToken0Selected, liquidityData]);

  useEffectOnce(() => {
    let mounted = true;
    if (poolAddress == null) return;
    async function fetch(poolAddress: string) {
      const poolBasics = await getUniswapPoolBasics(poolAddress, provider);
      if (mounted) {
        setUniswapPoolBasics(poolBasics);
      }
    }    
    fetch(poolAddress);
    return () => {
      mounted = false;
    }
  });

  useEffect(() => {
    if (!uniswapPoolBasics) return;
    const updatedTickInfo = calculateTickInfo(uniswapPoolBasics, token0, token1, isToken0Selected);
    setTickInfo(updatedTickInfo);
  }, [isToken0Selected, uniswapPoolBasics])

  useEffect(() => {
    //Handles the initial render and whenever the selected token changes
    if (previousActionCardState?.textFields) {
      setLocalToken0Amount(previousActionCardState.textFields[0]);
      setLocalToken1Amount(previousActionCardState.textFields[1]);
    }
  }, [isToken0Selected]);
  
  let lower: TickPrice | null = null;
  let upper: TickPrice | null = null;
  let currentTick: number | null = (uniswapPoolBasics && uniswapPoolBasics.slot0.tick) || null;
  const lowerBound = previousActionCardState?.uniswapResult?.uniswapPosition.lowerBound;
  const upperBound = previousActionCardState?.uniswapResult?.uniswapPosition.upperBound;
  let slippagePercentage = previousActionCardState?.textFields?.[4] ?? '';
  
  if (tickInfo != null && lowerBound && upperBound) {
    lower = {
      price: tickToPrice(
        lowerBound,
        token0.decimals,
        token1.decimals,
        isToken0Selected,
      ),
      tick: lowerBound,
    }
    upper = {
      price: tickToPrice(
        upperBound,
        token0.decimals,
        token1.decimals,
        isToken0Selected,
      ),
      tick: upperBound,
    }
  } else if (tickInfo != null && uniswapPoolBasics != null) {
    const lowerTick = roundDownToNearestN(
      uniswapPoolBasics.slot0.tick - 100,
      tickInfo.tickSpacing
    );
    const upperTick = roundUpToNearestN(
      uniswapPoolBasics.slot0.tick + 100,
      tickInfo.tickSpacing
    );
    const lowerPrice = tickToPrice(
      lowerTick,
      token0.decimals,
      token1.decimals,
      isToken0Selected
    );
    const upperPrice = tickToPrice(
      upperTick,
      token0.decimals,
      token1.decimals,
      isToken0Selected
    );

    lower = {
      price: isToken0Selected ? lowerPrice : upperPrice,
      tick: isToken0Selected ? lowerTick : upperTick,
    };
    upper = {
      price: isToken0Selected ? upperPrice : lowerPrice,
      tick: isToken0Selected ? upperTick : lowerTick,
    };
  }

  let isAmount0InputDisabled = true;
  let isAmount1InputDisabled = true;

  if (lower != null && upper != null && currentTick != null) {
    isAmount0InputDisabled = shouldAmount0InputBeDisabled(lower.tick, upper.tick, currentTick);
    isAmount1InputDisabled = shouldAmount1InputBeDisabled(lower.tick, upper.tick, currentTick);
  }

  function handleUpdateSlippagePercentage(updatedSlippage: string) {
    const prevUniswapPosition = previousActionCardState?.uniswapResult?.uniswapPosition;
    const prevTextFields = previousActionCardState?.textFields ?? ['', '', '', '', ''];
    prevTextFields[4] = updatedSlippage;

    onChange({
      actionId: ActionID.ADD_LIQUIDITY,
      textFields: prevTextFields,
      aloeResult: null,
      uniswapResult: {
        uniswapPosition: {
          liquidity: prevUniswapPosition?.liquidity || JSBI.BigInt(0),
          amount0: prevUniswapPosition?.amount0 || 0,
          amount1: prevUniswapPosition?.amount1 || 0,
          lowerBound: prevUniswapPosition?.lowerBound || null,
          upperBound: prevUniswapPosition?.upperBound || null,
        },
        slippageTolerance: parseFloat(updatedSlippage) || undefined,
        isAmount0LastUpdated: previousActionCardState?.uniswapResult?.isAmount0LastUpdated,
        isToken0Selected: previousActionCardState?.uniswapResult?.isToken0Selected,
      }
    })
  }

  function handleLocalToken0AmountInput(value: string) {
    if (uniswapPoolBasics == null || lower == null || upper == null) return;
    const output = formatNumberInput(value);
    if (output != null) {
      const floatOutput = parseFloat(output);
      if (!isNaN(floatOutput)) {
        const {amount1, liquidity} = calculateAmount1FromAmount0(floatOutput, lower.tick, upper.tick, uniswapPoolBasics.slot0.tick, token0.decimals, token1.decimals);
        setLocalToken1Amount(amount1);
        setLocalLiquidityJSBI(liquidity);
      } else {
        setLocalToken1Amount('');
        setLocalLiquidityJSBI(JSBI.BigInt(0));
      }
      setLocalToken0Amount(output);
      setLocalIsAmount0LastUpdated(true);
    }
  }

  function handleLocalToken1AmountInput(value: string) {
    if (uniswapPoolBasics == null || lower == null || upper == null) return;
    const output = formatNumberInput(value);
    if (output != null) {
      const floatOutput = parseFloat(output);
      if (!isNaN(floatOutput)) {
        const {amount0, liquidity} = calculateAmount0FromAmount1(floatOutput, lower.tick, upper.tick, uniswapPoolBasics.slot0.tick, token0.decimals, token1.decimals);
        setLocalToken0Amount(amount0);
        setLocalLiquidityJSBI(liquidity);
      } else {
        setLocalToken0Amount('');
        setLocalLiquidityJSBI(JSBI.BigInt(0));
      }
      setLocalToken1Amount(output);
      setLocalIsAmount0LastUpdated(false);
    }
  }

  function updateRange(amount0: string, amount1: string, lowerTick: number | null, upperTick: number | null) {
    onChange({
      actionId: ActionID.ADD_LIQUIDITY,
      textFields: [amount0, amount1, lowerTick?.toFixed(0) ?? '', upperTick?.toFixed(0) ?? '', previousActionCardState?.textFields?.[4] ?? ''],
      aloeResult: {
        token0RawDelta: -parseFloat(amount0) || undefined,
        token1RawDelta: -parseFloat(amount1) || undefined,
        selectedToken: null,
      },
      uniswapResult: {
        uniswapPosition: {
          liquidity: localLiquidityJSBI,
          amount0: parseFloat(amount0) || 0,
          amount1: parseFloat(amount1) || 0,
          lowerBound: lowerTick,
          upperBound: upperTick,
        },
        slippageTolerance: previousActionCardState?.uniswapResult?.slippageTolerance,
        isAmount0LastUpdated: localIsAmount0LastUpdated,
        isToken0Selected: isToken0Selected,
      },
    });
  }

  function calculateUpdatedAmounts(lowerTick: number | null, upperTick: number | null) {
    const numericAmount0 = parseFloat(localToken0Amount);
    const numericAmount1 = parseFloat(localToken1Amount);

    if (!isNaN(numericAmount0) && !isNaN(numericAmount1) && lowerTick != null && upperTick != null && currentTick != null) {
      if (localIsAmount0LastUpdated) {
        const {amount1, liquidity} = calculateAmount1FromAmount0(numericAmount0, lowerTick, upperTick, currentTick, token0.decimals, token1.decimals);
        setLocalToken1Amount(amount1);
        setLocalLiquidityJSBI(liquidity);
        return [localToken0Amount, amount1];
      } else {
        const {amount0, liquidity} = calculateAmount0FromAmount1(numericAmount1, lowerTick, upperTick, currentTick, token0.decimals, token1.decimals);
        setLocalToken0Amount(amount0);
        setLocalLiquidityJSBI(liquidity);
        return [amount0, localToken1Amount];
      }
    }
    return [localToken0Amount, localToken1Amount];
  }

  function updateLower(updatedLower: TickPrice) {
    const updatedAmounts = calculateUpdatedAmounts(updatedLower.tick, upper?.tick || null);
    updateRange(updatedAmounts[0], updatedAmounts[1], updatedLower.tick, upper?.tick || null);
  }

  function updateUpper(updatedUpper: TickPrice) {
    const updatedAmounts = calculateUpdatedAmounts(lower?.tick || null, updatedUpper.tick);
    updateRange(updatedAmounts[0], updatedAmounts[1], lower?.tick || null, updatedUpper.tick);
  }

  function updateTokenAmountInput() {
    updateRange(localToken0Amount, localToken1Amount, lower?.tick ?? null, upper?.tick ?? null);
  }

  return (
    <BaseActionCard
      action={ActionID.ADD_LIQUIDITY}
      actionProvider={ActionProviders.UniswapV3}
      isCausingError={isCausingError}
      onRemove={onRemove}
    >
      <div className='w-full flex justify-between items-center gap-2 mb-4'>
        {token0 && token1 && (
          <TokenChooser
            token0={token0}
            token1={token1}
            isToken0Selected={isToken0Selected}
            setIsToken0Selected={(updatedValue: boolean) => {
              onChange({
                actionId: ActionID.ADD_LIQUIDITY,
                aloeResult: null,
                uniswapResult: {
                  uniswapPosition: {
                    liquidity: JSBI.BigInt(0),
                    amount0: 0,
                    amount1: 0,
                    lowerBound: null,
                    upperBound: null,
                  },
                  slippageTolerance: previousActionCardState?.uniswapResult?.slippageTolerance,
                  isToken0Selected: updatedValue,
                  isAmount0LastUpdated: false,
                },
              });
            }}
          />
        )}
        <Settings
          slippagePercentage={slippagePercentage}
          updateSlippagePercentage={handleUpdateSlippagePercentage}
        />
      </div>
      {chartData.length > 0 && uniswapPoolBasics != null && lower != null && upper != null && (
        <LiquidityChart
          data={chartData}
          rangeStart={lower.price}
          rangeEnd={upper.price}
          currentPrice={tickToPrice(uniswapPoolBasics?.slot0.tick, token0.decimals, token1.decimals, isToken0Selected)}
        />
      )}
      {(chartData.length === 0 || uniswapPoolBasics == null || lower == null || upper == null) && (
        <LiquidityChartPlaceholder />
      )}
      <div className='flex flex-row gap-2 mb-4'>
        <SteppedInput
          value={lower?.price || ''}
          label='Min Price'
          token0={token0}
          token1={token1}
          isToken0Selected={isToken0Selected}
          onChange={(value) => {
            const valueAsFloat = parseFloat(value);
            if (isNaN(valueAsFloat) || valueAsFloat === 0 || tickInfo == null || lower == null || upper == null) {
              return;
            }
            //Always in terms of token0
            const numericValue = isToken0Selected ? valueAsFloat : 1.0 / valueAsFloat;
            const nearestTick = roundUpToNearestN(priceToTick(numericValue, token0.decimals, token1.decimals), tickInfo.tickSpacing);
            const nearestPrice = tickToPrice(nearestTick, token0.decimals, token1.decimals, isToken0Selected);
            if ((parseFloat(nearestPrice) < parseFloat(upper.price)) &&
                (nearestTick >= MIN_TICK)) {
              updateLower({
                price: nearestPrice,
                tick: nearestTick,
              });
            }
          }}
          onDecrement={() => {
            if (!tickInfo || !lower || !upper) {
              return;
            }
            //If token1 is selected, we want to increment the lower tick as ticks are in reverse order
            const updatedTick = isToken0Selected ? lower.tick - tickInfo.tickSpacing : lower.tick + tickInfo.tickSpacing;
            const isUpdatedTickWithinBounds = MIN_TICK <= updatedTick && updatedTick <= MAX_TICK;
            const isUpdatedTickLessThanUpper = isToken0Selected ? updatedTick < upper.tick : updatedTick > upper.tick;
            if (isUpdatedTickWithinBounds && isUpdatedTickLessThanUpper) {
              updateLower({
                price: tickToPrice(updatedTick, token0.decimals, token1.decimals, isToken0Selected),
                tick: updatedTick,
              });
            }
          }}
          onIncrement={() => {
            if (!tickInfo || !lower || !upper) {
              return;
            }
            //If token1 is selected, we want to decrement the lower tick as ticks are in reverse order
            const updatedTick = isToken0Selected ? lower.tick + tickInfo.tickSpacing : lower.tick - tickInfo.tickSpacing;
            const isUpdatedTickWithinBounds = MIN_TICK <= updatedTick && updatedTick <= MAX_TICK;
            const isUpdatedTickLessThanUpper = isToken0Selected ? updatedTick < upper.tick : updatedTick > upper.tick;
            if (isUpdatedTickWithinBounds && isUpdatedTickLessThanUpper) {
              updateLower({
                price: tickToPrice(updatedTick, token0.decimals, token1.decimals, isToken0Selected),
                tick: updatedTick,
              });
            }
          }}
          decrementDisabled={tickInfo == null || lower == null}
          incrementDisabled={
            tickInfo == null ||
            lower == null ||
            upper == null ||
            !(isToken0Selected ? 
              (isToken0Selected ? lower.tick + tickInfo.tickSpacing : lower.tick - tickInfo.tickSpacing) < upper.tick :
              (isToken0Selected ? lower.tick + tickInfo.tickSpacing : lower.tick - tickInfo.tickSpacing) > upper.tick
            )
          }
          disabled={poolAddress == null}
        />
        <SteppedInput
          value={upper?.price || ''}
          label='Max Price'
          token0={token0}
          token1={token1}
          isToken0Selected={isToken0Selected}
          onChange={(value) => {
            const valueAsFloat = parseFloat(value);
            if (isNaN(valueAsFloat) || valueAsFloat === 0 || tickInfo == null || lower == null || upper == null) {
              return;
            }
            //Always in terms of token0
            const numericValue = isToken0Selected ? valueAsFloat : 1.0 / valueAsFloat;
            const nearestTick = roundUpToNearestN(priceToTick(numericValue, token0.decimals, token1.decimals), tickInfo.tickSpacing);
            const nearestPrice = tickToPrice(nearestTick, token0.decimals, token1.decimals, isToken0Selected);
            if ((parseFloat(nearestPrice) > parseFloat(lower.price)) &&
                (nearestTick <= MAX_TICK)) {
              updateUpper({
                price: nearestPrice,
                tick: nearestTick,
              });
            }
          }}
          onDecrement={() => {
            if (!tickInfo || !lower || !upper) {
              return;
            }
            const updatedTick = isToken0Selected ? upper.tick - tickInfo.tickSpacing : upper.tick + tickInfo.tickSpacing;
            const isUpdatedTickWithinBounds = MIN_TICK <= updatedTick && updatedTick <= MAX_TICK;
            const isUpdatedTickGreaterThanLower = isToken0Selected ? updatedTick > lower.tick : updatedTick < lower.tick;
            if (isUpdatedTickWithinBounds && isUpdatedTickGreaterThanLower) {
              updateUpper({
                price: tickToPrice(updatedTick, token0.decimals, token1.decimals, isToken0Selected),
                tick: updatedTick,
              });
            }
          }}
          onIncrement={() => {
            if (!tickInfo || !lower || !upper) {
              return;
            }
            const updatedTick = isToken0Selected ? upper.tick + tickInfo.tickSpacing : upper.tick - tickInfo.tickSpacing;
            const isUpdatedTickWithinBounds = MIN_TICK <= updatedTick && updatedTick <= MAX_TICK;
            const isUpdatedTickGreaterThanLower = isToken0Selected ? updatedTick > lower.tick : updatedTick < lower.tick;
            if (isUpdatedTickWithinBounds && isUpdatedTickGreaterThanLower) {
              updateUpper({
                price: tickToPrice(updatedTick, token0.decimals, token1.decimals, isToken0Selected),
                tick: updatedTick,
              });
            }
          }}
          decrementDisabled={
            tickInfo == null ||
            lower == null ||
            upper == null ||
            !(isToken0Selected ? 
              (isToken0Selected ? upper.tick - tickInfo.tickSpacing : upper.tick + tickInfo.tickSpacing) > lower.tick :
              (isToken0Selected ? upper.tick - tickInfo.tickSpacing : upper.tick + tickInfo.tickSpacing) < lower.tick
            )
          }
          incrementDisabled={
            tickInfo == null ||
            upper == null
          }
          disabled={poolAddress == null}
        />
      </div>
      <div className='w-full flex flex-col gap-4'>
        <TokenAmountInput
          tokenLabel={token0?.ticker || ''}
          value={isAmount0InputDisabled ? '' :localToken0Amount}
          onChange={handleLocalToken0AmountInput}
          onBlur={updateTokenAmountInput}
          disabled={isAmount0InputDisabled}
        />
        <TokenAmountInput
          tokenLabel={token1?.ticker || ''}
          value={isAmount1InputDisabled ? '' : localToken1Amount}
          onChange={handleLocalToken1AmountInput}
          onBlur={updateTokenAmountInput}
          disabled={isAmount1InputDisabled}
        />
      </div>
    </BaseActionCard>
  );
}
