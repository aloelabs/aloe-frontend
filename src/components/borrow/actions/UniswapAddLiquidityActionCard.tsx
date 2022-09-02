import { useEffect, useState } from 'react';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, ActionProviders } from '../../../data/Actions';
import SteppedInput from '../uniswap/SteppedInput';
import LiquidityChart, {
  ChartEntry,
} from '../uniswap/LiquidityChart';
import { theGraphUniswapV3Client } from '../../../App';
import { UniswapTicksQuery } from '../../../util/GraphQL';
import { ApolloQueryResult } from '@apollo/react-hooks';
import Big from 'big.js';
import TokenAmountInput from '../../common/TokenAmountInput';
import TokenChooser from '../../common/TokenChooser';
import styled from 'styled-components';
import tw from 'twin.macro';
import Settings from '../uniswap/Settings';
import { calculateAmount0FromAmount1, calculateAmount1FromAmount0, calculateTickData, calculateTickInfo, getMinTick, getUniswapPoolBasics, priceToTick, shouldAmount0InputBeDisabled, shouldAmount1InputBeDisabled, TickData, TickInfo, tickToPrice, UniswapV3GraphQLTicksQueryResponse, UniswapV3PoolBasics } from '../../../util/Uniswap';
import { useProvider } from 'wagmi';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { formatNumberInput, roundDownToNearestN, roundUpToNearestN } from '../../../util/Numbers';
import { TokenData } from '../../../data/TokenData';
import { TickMath } from '@uniswap/v3-sdk';
import { LiquidityChartPlaceholder } from '../uniswap/LiquidityChartPlaceholder';

type TickPrice = {
  price: string;
  tick: number;
};

//Debouncing helps us avoid maxing out cpu usage
const DEBOUNCE_DELAY = 150;

//TODO: This is a temporary workaround for getting the pool, 
// in the future we need to take into account the fee tier and get this from another source.
function tokensToPool(token0: TokenData, token1: TokenData): string {
  if (token0.address.toLowerCase() === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' && token1.address.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') {
    return '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640';
  } else if (token0.address.toLowerCase() === '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599' && token1.address.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') {
    return '0x4585fe77225b41b697c938b018e2ac67ac5a20c0';
  } else {
    return '';
  }
}

export default function UniswapAddLiquidityActionCard(props: ActionCardProps) {
  const { token0, token1, previousActionCardState, onChange, onRemove } = props;

  const isToken0Selected = previousActionCardState?.uniswapResult?.isToken0Selected || false;

  const [localIsAmount0LastUpdated, setLocalIsAmount0LastUpdated] = useState(false);
  const [localToken0Amount, setLocalToken0Amount] = useState('');
  const [localToken1Amount, setLocalToken1Amount] = useState('');
  const [uniswapPoolBasics, setUniswapPoolBasics] = useState<UniswapV3PoolBasics | null>(null);
  const [tickInfo, setTickInfo] = useState<TickInfo | null>(null);
  const [isLiquidityDataLoading, setIsLiquidityDataLoading] = useState(true);
  const [liquidityData, setLiquidityData] = useState<TickData[]>([]);
  const [chartData, setChartData] = useState<ChartEntry[]>([]);

  const provider = useProvider();

  useEffectOnce(() => {
    let mounted = true;
    if (token0 == null || token1 == null) return;
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
    const poolAddress = tokensToPool(token0, token1);
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
    async function fetch(poolAddress: string) {
      const poolBasics = await getUniswapPoolBasics(poolAddress, provider);
      if (mounted) {
        setUniswapPoolBasics(poolBasics);
      }
    }
    const poolAddress = tokensToPool(token0, token1);
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
    if (previousActionCardState?.uniswapResult) {
      const uniswapPosition = previousActionCardState?.uniswapResult?.uniswapPosition;
      if (uniswapPosition) {
        setLocalToken0Amount(uniswapPosition.amount0.inputValue);
        setLocalToken1Amount(uniswapPosition.amount1.inputValue);
      }
    }
  }, [isToken0Selected]);
  

  let lower: TickPrice | null = null;
  let upper: TickPrice | null = null;
  let currentTick: number | null = (uniswapPoolBasics && uniswapPoolBasics.slot0.tick) || null;
  

  if (previousActionCardState?.uniswapResult) {
      const uniswapPosition = previousActionCardState?.uniswapResult?.uniswapPosition;
      if (uniswapPosition && uniswapPosition.lowerBound != null) {
        lower = {
          price: tickToPrice(uniswapPosition.lowerBound, token0.decimals, token1.decimals, isToken0Selected),
          tick: uniswapPosition.lowerBound,
        };
      } else if (tickInfo != null) {
        const lowerTick = roundDownToNearestN(tickInfo.minTick + (tickInfo.tickOffset / 2), tickInfo.tickSpacing);
        const upperTick = roundUpToNearestN(tickInfo.maxTick - (tickInfo.tickOffset / 2), tickInfo.tickSpacing);
        const lowerPrice = tickToPrice(lowerTick, token0.decimals, token1.decimals, isToken0Selected);
        const upperPrice = tickToPrice(upperTick, token0.decimals, token1.decimals, isToken0Selected);
        lower = {
          price: isToken0Selected ? lowerPrice : upperPrice,
          tick: isToken0Selected ? lowerTick : upperTick,
        };
      }

      if (uniswapPosition && uniswapPosition.upperBound != null) {
        upper = {
          price: tickToPrice(uniswapPosition.upperBound, token0.decimals, token1.decimals, isToken0Selected),
          tick: uniswapPosition.upperBound,
        };
      } else if (tickInfo != null) {
        const lowerTick = roundDownToNearestN(tickInfo.minTick + (tickInfo.tickOffset / 2), tickInfo.tickSpacing);
        const upperTick = roundUpToNearestN(tickInfo.maxTick - (tickInfo.tickOffset / 2), tickInfo.tickSpacing);
        const lowerPrice = tickToPrice(lowerTick, token0.decimals, token1.decimals, isToken0Selected);
        const upperPrice = tickToPrice(upperTick, token0.decimals, token1.decimals, isToken0Selected);
        upper = {
          price: isToken0Selected ? upperPrice : lowerPrice,
          tick: isToken0Selected ? upperTick : lowerTick,
        };
      }
      // console.log(uniswapPosition.lowerBound);
      // console.log(tickToPrice(uniswapPosition.lowerBound, token0.decimals, token1.decimals, isToken0Selected));
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

  function handleLocalToken0AmountInput(value: string) {
    if (uniswapPoolBasics == null || lower == null || upper == null) return;
    const output = formatNumberInput(value);
    if (output != null) {
      const floatOutput = parseFloat(output);
      if (!isNaN(floatOutput)) {
        setLocalToken1Amount(calculateAmount1FromAmount0(floatOutput, lower.tick, upper.tick, uniswapPoolBasics.slot0.tick, token0.decimals, token1.decimals));
      } else {
        setLocalToken1Amount('');
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
        setLocalToken0Amount(calculateAmount0FromAmount1(floatOutput, lower.tick, upper.tick, uniswapPoolBasics.slot0.tick, token0.decimals, token1.decimals));
      } else {
        setLocalToken0Amount('');
      }
      setLocalToken1Amount(output);
      setLocalIsAmount0LastUpdated(false);
    }
  }

  //TODO: try to consolidate this function and updateUpper's logic
  function updateLower(updatedLower: TickPrice) {
    const numericAmount0 = parseFloat(localToken0Amount);
    const numericAmount1 = parseFloat(localToken1Amount);
    let updatedAmount0 = localToken0Amount;
    let updatedAmount1 = localToken1Amount;
    if (!isNaN(numericAmount0) && !isNaN(numericAmount1) && lower != null && upper != null && currentTick != null) {
      if (localIsAmount0LastUpdated) {
        updatedAmount1 = calculateAmount1FromAmount0(numericAmount0, updatedLower.tick, upper.tick, currentTick, token0.decimals, token1.decimals);
        setLocalToken1Amount(updatedAmount1);
      } else {
        updatedAmount0 = calculateAmount0FromAmount1(numericAmount1, updatedLower.tick, upper.tick, currentTick, token0.decimals, token1.decimals);
        setLocalToken0Amount(updatedAmount0);
      }
    }
    onChange({
      aloeResult: null,
      uniswapResult: {
        uniswapPosition: {
          amount0: {
            inputValue: updatedAmount0,
            numericValue: parseFloat(updatedAmount0) || 0,
          },
          amount1: {
            inputValue: updatedAmount1,
            numericValue: parseFloat(updatedAmount1) || 0,
          },
          lowerBound: updatedLower.tick,
          upperBound: upper?.tick || null,
        },
        isToken0Selected: isToken0Selected,
        isAmount0LastUpdated: localIsAmount0LastUpdated,
      },
    });
  }

  //TODO: try to consolidate this function and updateLower's logic
  function updateUpper(updatedUpper: TickPrice) {
    const numericAmount0 = parseFloat(localToken0Amount);
    const numericAmount1 = parseFloat(localToken1Amount);
    let updatedAmount0 = localToken0Amount;
    let updatedAmount1 = localToken1Amount;
    if (!isNaN(numericAmount0) && !isNaN(numericAmount1) && lower != null && upper != null && currentTick != null) {
      if (localIsAmount0LastUpdated) {
        updatedAmount1 = calculateAmount1FromAmount0(numericAmount0, lower.tick, updatedUpper.tick, currentTick, token0.decimals, token1.decimals);
        setLocalToken1Amount(updatedAmount1);
      } else {
        updatedAmount0 = calculateAmount0FromAmount1(numericAmount1, lower.tick, updatedUpper.tick, currentTick, token0.decimals, token1.decimals);
        setLocalToken0Amount(updatedAmount0);
      }
    }
    onChange({
      aloeResult: null,
      uniswapResult: {
        uniswapPosition: {
          amount0: {
            inputValue: updatedAmount0,
            numericValue: parseFloat(updatedAmount0) || 0,
          },
          amount1: {
            inputValue: updatedAmount1,
            numericValue: parseFloat(updatedAmount1) || 0,
          },
          lowerBound: lower?.tick || null,
          upperBound: updatedUpper.tick,
        },
        isToken0Selected: isToken0Selected,
        isAmount0LastUpdated: localIsAmount0LastUpdated,
      },
    });
  }

  function updateTokenAmountInput() {
    onChange({
      aloeResult: null,
      uniswapResult: {
        uniswapPosition: {
          amount0: {
            inputValue: localToken0Amount,
            numericValue: parseFloat(localToken0Amount) || 0,
          },
          amount1: {
            inputValue: localToken1Amount,
            numericValue: parseFloat(localToken1Amount) || 0,
          },
          lowerBound: lower?.tick || null,
          upperBound: upper?.tick || null,
        },
        isToken0Selected: isToken0Selected,
        isAmount0LastUpdated: localIsAmount0LastUpdated,
      },
    });
  }

  return (
    <BaseActionCard
      action={ActionProviders.UniswapV3.actions.ADD_LIQUIDITY.name}
      actionProvider={ActionProviders.UniswapV3}
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
                  aloeResult: null,
                  uniswapResult: {
                    uniswapPosition: {
                      amount0: {
                        inputValue: '',
                        numericValue: 0,
                      },
                      amount1: {
                        inputValue: '',
                        numericValue: 0,
                      },
                      lowerBound: null,
                      upperBound: null,
                    },
                    isToken0Selected: updatedValue,
                    isAmount0LastUpdated: false,
                  },
                });
                  // setLower({
                  //   price: isToken0Selected ? lowerPrice : upperPrice,
                  //   tick: isToken0Selected ? lowerTick : upperTick,
                  // });
                  // setUpper({
                  //   price: isToken0Selected ? upperPrice : lowerPrice,
                  //   tick: isToken0Selected ? upperTick : lowerTick,
                  // });
            }}
          />
        )}
        <Settings />
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
            if (parseFloat(value) === 0 || tickInfo == null || lower == null || upper == null) {
              return;
            }
            //Always in terms of token0
            const numericValue = isToken0Selected ? parseFloat(value) : 1.0 / parseFloat(value);
            const nearestTick = roundUpToNearestN(priceToTick(numericValue, token0.decimals, token1.decimals), tickInfo.tickSpacing);
            const nearestPrice = tickToPrice(nearestTick, token0.decimals, token1.decimals, isToken0Selected);
            if ((parseFloat(nearestPrice) < parseFloat(upper.price)) &&
                (parseFloat(nearestPrice) >= tickInfo.minPrice)) {
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
            const isUpdatedTickWithinBounds = tickInfo.minTick <= updatedTick && updatedTick <= tickInfo.maxTick;
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
            const isUpdatedTickWithinBounds = tickInfo.minTick <= updatedTick && updatedTick <= tickInfo.maxTick;
            const isUpdatedTickLessThanUpper = isToken0Selected ? updatedTick < upper.tick : updatedTick > upper.tick;
            if (isUpdatedTickWithinBounds && isUpdatedTickLessThanUpper) {
              updateLower({
                price: tickToPrice(updatedTick, token0.decimals, token1.decimals, isToken0Selected),
                tick: updatedTick,
              });
            }
          }}
          decrementDisabled={
            tickInfo == null ||
            lower == null ||
            lower.tick === tickInfo.minTick ||
            lower.tick === tickInfo.maxTick
          }
          incrementDisabled={
            tickInfo == null ||
            lower == null ||
            upper == null ||
            !(isToken0Selected ? 
              (isToken0Selected ? lower.tick + tickInfo.tickSpacing : lower.tick - tickInfo.tickSpacing) < upper.tick :
              (isToken0Selected ? lower.tick + tickInfo.tickSpacing : lower.tick - tickInfo.tickSpacing) > upper.tick
            )
          }
        />
        <SteppedInput
          value={upper?.price || ''}
          label='Max Price'
          token0={token0}
          token1={token1}
          isToken0Selected={isToken0Selected}
          onChange={(value) => {
            if (parseFloat(value) === 0 || tickInfo == null || lower == null || upper == null) {
              return;
            }
            //Always in terms of token0
            const numericValue = isToken0Selected ? parseFloat(value) : 1.0 / parseFloat(value);
            const nearestTick = roundUpToNearestN(priceToTick(numericValue, token0.decimals, token1.decimals), tickInfo.tickSpacing);
            const nearestPrice = tickToPrice(nearestTick, token0.decimals, token1.decimals, isToken0Selected);
            if ((parseFloat(nearestPrice) > parseFloat(lower.price)) &&
                (parseFloat(nearestPrice) <= tickInfo.maxPrice)) {
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
            const isUpdatedTickWithinBounds = tickInfo.minTick <= updatedTick && updatedTick <= tickInfo.maxTick;
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
            const isUpdatedTickWithinBounds = tickInfo.minTick <= updatedTick && updatedTick <= tickInfo.maxTick;
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
            upper == null ||
            upper.tick === tickInfo.minTick ||
            upper.tick === tickInfo.maxTick
          }
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
