import { useEffect, useState } from 'react';

import { TickMath } from '@uniswap/v3-sdk';
import JSBI from 'jsbi';
import { Address, useProvider } from 'wagmi';

import { getAddLiquidityActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { addLiquidityOperator } from '../../../data/actions/ActionOperators';
import { ActionCardProps, ActionProviders } from '../../../data/actions/Actions';
import { runWithChecks } from '../../../data/actions/Utils';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { formatNumberInput, roundDownToNearestN, roundUpToNearestN } from '../../../util/Numbers';
import {
  calculateAmount0FromAmount1,
  calculateAmount1FromAmount0,
  calculateTickData,
  calculateTickInfo,
  getPoolAddressFromTokens,
  getUniswapPoolBasics,
  priceToTick,
  shouldAmount0InputBeDisabled,
  shouldAmount1InputBeDisabled,
  TickData,
  TickInfo,
  tickToPrice,
  UniswapV3PoolBasics,
} from '../../../util/Uniswap';
import TokenAmountInput from '../../common/TokenAmountInput';
import TokenChooser from '../../common/TokenChooser';
import { BaseActionCard } from '../BaseActionCard';
import LiquidityChart, { ChartEntry } from '../uniswap/LiquidityChart';
import { LiquidityChartPlaceholder } from '../uniswap/LiquidityChartPlaceholder';
import Settings from '../uniswap/Settings';
import SteppedInput from '../uniswap/SteppedInput';

const MIN_TICK = TickMath.MIN_TICK;
const MAX_TICK = TickMath.MAX_TICK;

type TickPrice = {
  price: number;
  tick: number;
};

export default function UniswapAddLiquidityActionCard(props: ActionCardProps<any>) {
  const { marginAccount, operand, fields, onRemove, onChange, onChange2 } = props;
  const { token0, token1, feeTier } = marginAccount;

  const [isCausingError, setIsCausingError] = useState(false);

  const isToken0Selected = fields?.uniswapResult?.isToken0Selected || false;

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
      // TODO replace this hard-coded string with `poolAddress` once we're done with testnet!!!
      const tickData = await calculateTickData('0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8', poolBasics);
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
    if (!fields?.uniswapResult) return;
    if (fields.uniswapResult.isToken0Selected) {
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
    };
  });

  useEffect(() => {
    if (!uniswapPoolBasics) return;
    const updatedTickInfo = calculateTickInfo(uniswapPoolBasics, token0, token1, isToken0Selected);
    setTickInfo(updatedTickInfo);
  }, [isToken0Selected, token0, token1, uniswapPoolBasics]);

  useEffect(() => {
    //Handles the initial render and whenever the selected token changes
    if (fields?.textFields) {
      setLocalToken0Amount(fields.textFields[0]);
      setLocalToken1Amount(fields.textFields[1]);
    }
  }, [isToken0Selected, fields?.textFields]);

  let lower: TickPrice | null = null;
  let upper: TickPrice | null = null;
  let currentTick: number | null = (uniswapPoolBasics && uniswapPoolBasics.slot0.tick) || null;
  const lowerBound = fields?.uniswapResult?.uniswapPosition.lower;
  const upperBound = fields?.uniswapResult?.uniswapPosition.upper;
  let slippagePercentage = fields?.textFields?.[4] ?? '';

  if (tickInfo != null && lowerBound && upperBound) {
    lower = {
      price: tickToPrice(lowerBound, token0.decimals, token1.decimals, isToken0Selected),
      tick: lowerBound,
    };
    upper = {
      price: tickToPrice(upperBound, token0.decimals, token1.decimals, isToken0Selected),
      tick: upperBound,
    };
  } else if (tickInfo != null && uniswapPoolBasics != null) {
    const lowerTick = roundDownToNearestN(uniswapPoolBasics.slot0.tick - 100, tickInfo.tickSpacing);
    const upperTick = roundUpToNearestN(uniswapPoolBasics.slot0.tick + 100, tickInfo.tickSpacing);
    const lowerPrice = tickToPrice(lowerTick, token0.decimals, token1.decimals, isToken0Selected);
    const upperPrice = tickToPrice(upperTick, token0.decimals, token1.decimals, isToken0Selected);

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
    const prevUniswapPosition = fields?.uniswapResult?.uniswapPosition;
    const prevTextFields = fields?.textFields ?? ['', '', '', '', ''];
    prevTextFields[4] = updatedSlippage;

    if (!operand) return;

    const updatedOperand = runWithChecks(
      marginAccount,
      addLiquidityOperator,
      operand,
      marginAccount.address as Address,
      prevUniswapPosition?.liquidity || JSBI.BigInt(0),
      prevUniswapPosition?.lower || 0,
      prevUniswapPosition?.upper || 0,
      currentTick || 0,
      token0.decimals,
      token1.decimals
    );

    onChange2({
      updatedOperand,
      fields: prevTextFields,
      actionArgs: undefined,
    });

    setIsCausingError(updatedOperand === undefined);
  }

  function handleLocalToken0AmountInput(value: string, forceUpdate?: boolean) {
    if (uniswapPoolBasics == null || lower == null || upper == null) return;
    const output = formatNumberInput(value);
    if (output != null) {
      const floatOutput = parseFloat(output);
      setLocalToken0Amount(output);
      setLocalIsAmount0LastUpdated(true);
      let updatedAmount1 = '';
      if (!isNaN(floatOutput)) {
        const { amount1, liquidity } = calculateAmount1FromAmount0(
          floatOutput,
          lower.tick,
          upper.tick,
          uniswapPoolBasics.slot0.tick,
          token0.decimals,
          token1.decimals
        );
        setLocalToken1Amount(amount1);
        setLocalLiquidityJSBI(liquidity);
        updatedAmount1 = amount1;
      } else {
        setLocalToken1Amount('');
        setLocalLiquidityJSBI(JSBI.BigInt(0));
      }
      if (forceUpdate) {
        updateRange(output, updatedAmount1, lower.tick, upper.tick);
      }
    }
  }

  function handleLocalToken1AmountInput(value: string, forceUpdate?: boolean) {
    if (uniswapPoolBasics == null || lower == null || upper == null) return;
    const output = formatNumberInput(value);
    if (output != null) {
      const floatOutput = parseFloat(output);
      setLocalToken1Amount(output);
      setLocalIsAmount0LastUpdated(false);
      let updatedAmount0 = '';
      if (!isNaN(floatOutput)) {
        const { amount0, liquidity } = calculateAmount0FromAmount1(
          floatOutput,
          lower.tick,
          upper.tick,
          uniswapPoolBasics.slot0.tick,
          token0.decimals,
          token1.decimals
        );
        setLocalToken0Amount(amount0);
        setLocalLiquidityJSBI(liquidity);
        updatedAmount0 = amount0;
      } else {
        setLocalToken0Amount('');
        setLocalLiquidityJSBI(JSBI.BigInt(0));
      }
      if (forceUpdate) {
        updateRange(updatedAmount0, output, lower.tick, upper.tick);
      }
    }
  }

  function updateRange(amount0: string, amount1: string, lowerTick: number | null, upperTick: number | null) {
    if (!operand) return;

    const updatedOperand = runWithChecks(
      marginAccount,
      addLiquidityOperator,
      operand,
      marginAccount.address as Address,
      localLiquidityJSBI,
      lowerTick || 0,
      upperTick || 0,
      currentTick || 0,
      token0.decimals,
      token1.decimals
    );

    onChange2({
      updatedOperand,
      fields: [
        amount0,
        amount1,
        lowerTick?.toFixed(0) ?? '',
        upperTick?.toFixed(0) ?? '',
        fields?.textFields?.[4] ?? '',
      ],
      actionArgs: getAddLiquidityActionArgs(lowerTick ?? 0, upperTick ?? 0, localLiquidityJSBI),
    });

    setIsCausingError(updatedOperand === undefined);
  }

  function calculateUpdatedAmounts(lowerTick: number | null, upperTick: number | null) {
    const numericAmount0 = parseFloat(localToken0Amount);
    const numericAmount1 = parseFloat(localToken1Amount);

    if (
      !isNaN(numericAmount0) &&
      !isNaN(numericAmount1) &&
      lowerTick != null &&
      upperTick != null &&
      currentTick != null
    ) {
      if (localIsAmount0LastUpdated) {
        const { amount1, liquidity } = calculateAmount1FromAmount0(
          numericAmount0,
          lowerTick,
          upperTick,
          currentTick,
          token0.decimals,
          token1.decimals
        );
        setLocalToken1Amount(amount1);
        setLocalLiquidityJSBI(liquidity);
        return [localToken0Amount, amount1];
      } else {
        const { amount0, liquidity } = calculateAmount0FromAmount1(
          numericAmount1,
          lowerTick,
          upperTick,
          currentTick,
          token0.decimals,
          token1.decimals
        );
        setLocalToken0Amount(amount0);
        setLocalLiquidityJSBI(liquidity);
        return [amount0, localToken1Amount];
      }
    }
    return [localToken0Amount, localToken1Amount];
  }

  function updateLower(updatedLower: TickPrice) {
    let shouldResetAmounts = false;
    if (upper != null && currentTick != null) {
      const willAmount0BeDisabled = shouldAmount0InputBeDisabled(updatedLower.tick, upper.tick, currentTick);
      shouldResetAmounts = willAmount0BeDisabled && localIsAmount0LastUpdated;
    }
    const updatedAmounts = shouldResetAmounts
      ? ['', localToken1Amount]
      : calculateUpdatedAmounts(updatedLower.tick, upper?.tick || null);
    updateRange(updatedAmounts[0], updatedAmounts[1], updatedLower.tick, upper?.tick || null);
    if (shouldResetAmounts) {
      setLocalIsAmount0LastUpdated(false);
    }
  }

  function updateUpper(updatedUpper: TickPrice) {
    let shouldResetAmounts = false;
    if (lower != null && currentTick != null) {
      const willAmount1BeDisabled = shouldAmount1InputBeDisabled(lower.tick, updatedUpper.tick, currentTick);
      shouldResetAmounts = willAmount1BeDisabled && !localIsAmount0LastUpdated;
    }
    const updatedAmounts = shouldResetAmounts
      ? [localToken0Amount, '']
      : calculateUpdatedAmounts(lower?.tick || null, updatedUpper.tick);
    updateRange(updatedAmounts[0], updatedAmounts[1], lower?.tick || null, updatedUpper.tick);
    if (shouldResetAmounts) {
      setLocalIsAmount0LastUpdated(true);
    }
  }

  function updateTokenAmountInput() {
    updateRange(localToken0Amount, localToken1Amount, lower?.tick ?? null, upper?.tick ?? null);
  }

  const max0 = operand?.assets.token0Raw ?? 0;
  const max1 = operand?.assets.token1Raw ?? 0;
  const maxString0 = Math.max(0, max0 - 1e-6).toFixed(6);
  const maxString1 = Math.max(0, max1 - 1e-6).toFixed(6);

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
                textFields: ['', ''],
                uniswapResult: {
                  uniswapPosition: {
                    liquidity: JSBI.BigInt(0),
                    lower: 0,
                    upper: 0,
                  },
                  slippageTolerance: fields?.uniswapResult?.slippageTolerance,
                  isToken0Selected: updatedValue,
                  isAmount0LastUpdated: false,
                },
              });
            }}
          />
        )}
        <Settings slippagePercentage={slippagePercentage} updateSlippagePercentage={handleUpdateSlippagePercentage} />
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
          value={lower?.price.toString(10) ?? ''}
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
            const nearestTick = roundUpToNearestN(
              priceToTick(numericValue, token0.decimals, token1.decimals),
              tickInfo.tickSpacing
            );
            const nearestPrice = tickToPrice(nearestTick, token0.decimals, token1.decimals, isToken0Selected);
            if (nearestPrice < upper.price && nearestTick >= MIN_TICK) {
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
            const updatedTick = isToken0Selected
              ? lower.tick - tickInfo.tickSpacing
              : lower.tick + tickInfo.tickSpacing;
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
            const updatedTick = isToken0Selected
              ? lower.tick + tickInfo.tickSpacing
              : lower.tick - tickInfo.tickSpacing;
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
            !(isToken0Selected
              ? (isToken0Selected ? lower.tick + tickInfo.tickSpacing : lower.tick - tickInfo.tickSpacing) < upper.tick
              : (isToken0Selected ? lower.tick + tickInfo.tickSpacing : lower.tick - tickInfo.tickSpacing) > upper.tick)
          }
          disabled={poolAddress == null}
        />
        <SteppedInput
          value={upper?.price.toString(10) ?? ''}
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
            const nearestTick = roundUpToNearestN(
              priceToTick(numericValue, token0.decimals, token1.decimals),
              tickInfo.tickSpacing
            );
            const nearestPrice = tickToPrice(nearestTick, token0.decimals, token1.decimals, isToken0Selected);
            if (nearestPrice > lower.price && nearestTick <= MAX_TICK) {
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
            const updatedTick = isToken0Selected
              ? upper.tick - tickInfo.tickSpacing
              : upper.tick + tickInfo.tickSpacing;
            const isUpdatedTickWithinBounds = MIN_TICK <= updatedTick && updatedTick <= MAX_TICK;
            const isUpdatedTickGreaterThanLower = isToken0Selected
              ? updatedTick > lower.tick
              : updatedTick < lower.tick;
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
            const updatedTick = isToken0Selected
              ? upper.tick + tickInfo.tickSpacing
              : upper.tick - tickInfo.tickSpacing;
            const isUpdatedTickWithinBounds = MIN_TICK <= updatedTick && updatedTick <= MAX_TICK;
            const isUpdatedTickGreaterThanLower = isToken0Selected
              ? updatedTick > lower.tick
              : updatedTick < lower.tick;
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
            !(isToken0Selected
              ? (isToken0Selected ? upper.tick - tickInfo.tickSpacing : upper.tick + tickInfo.tickSpacing) > lower.tick
              : (isToken0Selected ? upper.tick - tickInfo.tickSpacing : upper.tick + tickInfo.tickSpacing) < lower.tick)
          }
          incrementDisabled={tickInfo == null || upper == null}
          disabled={poolAddress == null}
        />
      </div>
      <div className='w-full flex flex-col gap-4'>
        <TokenAmountInput
          tokenLabel={token0?.ticker || ''}
          value={isAmount0InputDisabled ? '' : localToken0Amount}
          onChange={handleLocalToken0AmountInput}
          onBlur={updateTokenAmountInput}
          disabled={isAmount0InputDisabled}
          max={maxString0}
          maxed={localToken0Amount === maxString0}
          onMax={(maxValue: string) => {
            //When max is clicked, we want to forcefully update the amount inputs so we handle it ourselves
            handleLocalToken0AmountInput(maxValue, true);
          }}
        />
        <TokenAmountInput
          tokenLabel={token1?.ticker || ''}
          value={isAmount1InputDisabled ? '' : localToken1Amount}
          onChange={handleLocalToken1AmountInput}
          onBlur={updateTokenAmountInput}
          disabled={isAmount1InputDisabled}
          max={maxString1}
          maxed={localToken1Amount === maxString1}
          onMax={(maxValue: string) => {
            //When max is clicked, we want to forcefully update the amount inputs so we handle it ourselves
            handleLocalToken1AmountInput(maxValue, true);
          }}
        />
      </div>
    </BaseActionCard>
  );
}
