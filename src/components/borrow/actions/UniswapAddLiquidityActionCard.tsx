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
import { calculateAmount0FromAmount1, calculateAmount1FromAmount0, calculateTickData, calculateTickInfo, getUniswapPoolBasics, priceToTick, TickData, TickInfo, tickToPrice, UniswapV3GraphQLTicksQueryResponse, UniswapV3PoolBasics } from '../../../util/Uniswap';
import { useProvider } from 'wagmi';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { formatNumberInput, roundDownToNearestN, roundUpToNearestN } from '../../../util/Numbers';
import { TokenData } from '../../../data/TokenData';

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
  console.log(previousActionCardState);
  const [lower, setLower] = useState<TickPrice>({
    price: '',
    tick: 0,
  });
  const [upper, setUpper] = useState<TickPrice>({
    price: '',
    tick: 0,
  });
  const [token0Amount, setToken0Amount] = useState('');
  const [token1Amount, setToken1Amount] = useState('');
  const [isToken0Selected, setToken0Selected] = useState(false);
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

  useEffect(() => {
    let mounted = true;
    if (uniswapPoolBasics == null || token0 == null || token1 == null) return;
    const updatedTickInfo = calculateTickInfo(uniswapPoolBasics, token0, token1, isToken0Selected);
    if (mounted) {
      setTickInfo(updatedTickInfo);
    }
    const lowerTick = roundDownToNearestN(updatedTickInfo.minTick + (updatedTickInfo.tickOffset / 2), updatedTickInfo.tickSpacing);
    const upperTick = roundUpToNearestN(updatedTickInfo.maxTick - (updatedTickInfo.tickOffset / 2), updatedTickInfo.tickSpacing);
    //TODO: clean up this logic
    const lowerPrice = tickToPrice(lowerTick, token0.decimals, token1.decimals, isToken0Selected);
    const upperPrice = tickToPrice(upperTick, token0.decimals, token1.decimals, isToken0Selected);
    //TODO: clean up this logic
    if (mounted && isToken0Selected) {
      setLower({
        price: lowerPrice,
        tick: lowerTick,
      });
      setUpper({
        price: upperPrice,
        tick: upperTick,
      });
    } else if (mounted && !isToken0Selected) {
      setLower({
        price: upperPrice,
        tick: upperTick,
      });
      setUpper({
        price: lowerPrice,
        tick: lowerTick,
      });
    }
    
    return () => {
      mounted = false;
    }
  }, [uniswapPoolBasics, isToken0Selected]);

  useEffect(() => {
    if (isLiquidityDataLoading) {
      return;
    }
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

  function handleToken0AmountInput(value: string) {
    if (uniswapPoolBasics == null || token0 == null || token1 == null) return;
    const output = formatNumberInput(value);
    if (output != null) {
      const floatOutput = parseFloat(output);
      if (!isNaN(floatOutput)) {
        setToken1Amount(calculateAmount1FromAmount0(floatOutput, lower.tick, upper.tick, uniswapPoolBasics.slot0.tick, token0.decimals, token1.decimals));
      } else {
        setToken1Amount('');
      }
      setToken0Amount(output);
    }
  }

  function handleToken1AmountInput(value: string) {
    if (uniswapPoolBasics == null || token0 == null || token1 == null) return;
    const output = formatNumberInput(value);
    if (output != null) {
      const floatOutput = parseFloat(output);
      if (!isNaN(floatOutput)) {
        setToken0Amount(calculateAmount0FromAmount1(floatOutput, lower.tick, upper.tick, uniswapPoolBasics.slot0.tick, token0.decimals, token1.decimals));
      } else {
        setToken0Amount('');
      }
      setToken1Amount(output);
    }
  }

  let setLowerTimeout: NodeJS.Timeout;
  let setUpperTimeout: NodeJS.Timeout;

  //TODO: improve debounce logic (possibly move it to only debounce graph rendering if possible)
  function setLowerDebounced(updatedLower: TickPrice) {
    clearTimeout(setLowerTimeout);
    setLowerTimeout = setTimeout(() => {
      setLower(updatedLower);
    }, DEBOUNCE_DELAY);
  }

  //TODO: improve debounce logic (possibly move it to only debounce graph rendering if possible)
  function setUpperDebounced(updatedUpper: TickPrice) {
    clearTimeout(setUpperTimeout);
    setUpperTimeout = setTimeout(() => {
      setUpper(updatedUpper);
    }, DEBOUNCE_DELAY);
  }

  function updateLower(updatedLower: TickPrice) {
    onChange({
      token0RawDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token1RawDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token0DebtDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token1DebtDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token0PlusDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token1PlusDelta: {
        inputValue: '',
        numericValue: 0,
      },
      uniswapPositions: {
        amount0: {
          inputValue: token0Amount,
          numericValue: parseFloat(token0Amount) || 0,
        },
        amount1: {
          inputValue: token1Amount,
          numericValue: parseFloat(token1Amount) || 0,
        },
        lowerBound: updatedLower.tick,
        upperBound: upper.tick,
      },
      selectedTokenA: null,
    })
    setLower(updatedLower);
  }

  function updateUpper(updatedUpper: TickPrice) {
    onChange({
      token0RawDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token1RawDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token0DebtDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token1DebtDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token0PlusDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token1PlusDelta: {
        inputValue: '',
        numericValue: 0,
      },
      uniswapPositions: {
        amount0: {
          inputValue: token0Amount,
          numericValue: parseFloat(token0Amount) || 0,
        },
        amount1: {
          inputValue: token1Amount,
          numericValue: parseFloat(token1Amount) || 0,
        },
        lowerBound: lower.tick,
        upperBound: updatedUpper.tick,
      },
      selectedTokenA: null,
    })
    setUpper(updatedUpper);
  }

  function updateTokenAmountInput() {
    onChange({
      token0RawDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token1RawDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token0DebtDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token1DebtDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token0PlusDelta: {
        inputValue: '',
        numericValue: 0,
      },
      token1PlusDelta: {
        inputValue: '',
        numericValue: 0,
      },
      uniswapPositions: {
        amount0: {
          inputValue: token0Amount,
          numericValue: parseFloat(token0Amount) || 0,
        },
        amount1: {
          inputValue: token1Amount,
          numericValue: parseFloat(token1Amount) || 0,
        },
        lowerBound: lower.tick,
        upperBound: upper.tick,
      },
      selectedTokenA: null,
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
            setIsToken0Selected={setToken0Selected}
          />
        )}
        <Settings />
      </div>
      {chartData.length > 0 && uniswapPoolBasics != null && token0 != null && token1 != null && (
        <LiquidityChart
          data={chartData}
          rangeStart={lower.price}
          rangeEnd={upper.price}
          currentPrice={tickToPrice(uniswapPoolBasics?.slot0.tick, token0.decimals, token1.decimals, isToken0Selected)}
        />
      )}
      <div className='flex flex-row gap-2 mb-4'>
        <SteppedInput
          value={lower.price}
          label='Min Price'
          token0={token0}
          token1={token1}
          isToken0Selected={isToken0Selected}
          onChange={(value) => {
            if (parseFloat(value) === 0 || tickInfo == null || token0 == null || token1 == null) {
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
            if (!tickInfo || !token0 || !token1) {
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
            if (!tickInfo || token0 == null || token1 == null) {
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
            lower.tick === tickInfo.minTick ||
            lower.tick === tickInfo.maxTick
          }
          incrementDisabled={
            tickInfo == null ||
            !(isToken0Selected ? 
              (isToken0Selected ? lower.tick + tickInfo.tickSpacing : lower.tick - tickInfo.tickSpacing) < upper.tick :
              (isToken0Selected ? lower.tick + tickInfo.tickSpacing : lower.tick - tickInfo.tickSpacing) > upper.tick
            )
          }
        />
        <SteppedInput
          value={upper.price}
          label='Max Price'
          token0={token0}
          token1={token1}
          isToken0Selected={isToken0Selected}
          onChange={(value) => {
            if (parseFloat(value) === 0 || tickInfo == null || token0 == null || token1 == null) {
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
            if (!tickInfo || !token0 || !token1) {
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
            if (!tickInfo || !token0 || !token1) {
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
            !(isToken0Selected ? 
              (isToken0Selected ? upper.tick - tickInfo.tickSpacing : upper.tick + tickInfo.tickSpacing) > lower.tick :
              (isToken0Selected ? upper.tick - tickInfo.tickSpacing : upper.tick + tickInfo.tickSpacing) < lower.tick
            )
          }
          incrementDisabled={
            tickInfo == null ||
            upper.tick === tickInfo.minTick ||
            upper.tick === tickInfo.maxTick
          }
        />
      </div>
      <div className='w-full flex flex-col gap-4'>
        <TokenAmountInput
          tokenLabel={token0?.ticker || ''}
          value={token0Amount}
          onChange={handleToken0AmountInput}
          onBlur={updateTokenAmountInput}
        />
        <TokenAmountInput
          tokenLabel={token1?.ticker || ''}
          value={token1Amount}
          onChange={handleToken1AmountInput}
          onBlur={updateTokenAmountInput}
        />
      </div>
    </BaseActionCard>
  );
}
