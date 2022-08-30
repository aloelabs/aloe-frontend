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
import { getUniswapPoolBasics, priceToTick, tickToPrice, UniswapV3PoolBasics } from '../../../util/Uniswap';
import { useProvider } from 'wagmi';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { roundDownToNearestN, roundUpToNearestN } from '../../../util/Numbers';

type UniswapV3GraphQLTick = {
  tickIdx: string;
  liquidityNet: string;
  price0: string;
  price1: string;
  __typename: string;
};

type UniswapV3GraphQLTicksQueryResponse = {
  pools: {
    token0: { decimals: string };
    token1: { decimals: string };
    liquidity: string;
    tick: string;
    ticks: UniswapV3GraphQLTick[];
    __typename: string;
  }[];
};

type TickInfo = {
  tickSpacing: number;
  minTick: number;
  maxTick: number;
  minPrice: number;
  maxPrice: number;
};

export type TickData = {
  tick: number;
  liquidity: Big;
  amount0: number;
  amount1: number;
  price1In0: number;
  price0In1: number;
  totalValueIn0: number;
};

type TickPrice = {
  price: string;
  tick: number;
};

//Debouncing helps us avoid maxing out cpu usage
const DEBOUNCE_DELAY = 150;
const BINS_TO_FETCH = 1000;
const ONE = new Big('1.0');

function calculateNearestPrice(price: number, data: ChartEntry[]): TickPrice {
  const nearest: ChartEntry = data.reduce(
    (prev: ChartEntry, cur: ChartEntry) => {
      const prevDifference = Math.abs(prev.price - price);
      const curDifference = Math.abs(cur.price - price);
      return curDifference < prevDifference ? cur : prev;
    }
  );
  return {
    price: nearest.price.toString(),
    //TODO: look into to avoiding having to use indexOf
    tick: data.indexOf(nearest),
  };
}

const SvgButtonWrapper = styled.button`
  ${tw`flex justify-center items-center`}
  height: max-content;
  width: max-content;
  margin-top: auto;
  margin-bottom: auto;
  background-color: transparent;
  border-radius: 8px;
  padding: 6px;
  svg {
    path {
      stroke: #fff;
    }
  }

  &:hover {
    svg {
      path {
        stroke: rgba(255, 255, 255, 0.75);
      }
    }
  }
`;

export default function UniswapAddLiquidityActionCard(props: ActionCardProps) {
  const { token0, token1, previousActionCardState, onChange, onRemove } = props;
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
    async function fetch(poolAddress: string) {
      const poolBasics = await getUniswapPoolBasics(poolAddress, provider);
      setUniswapPoolBasics(poolBasics);
      //TODO: make binsToFetch a constant
      const tickOffset = Math.floor(BINS_TO_FETCH * poolBasics.tickSpacing / 2);
      const minTick = poolBasics.slot0.tick - tickOffset;
      const maxTick = poolBasics.slot0.tick + tickOffset;
      //TODO: determine tickSpacing dynamically
      const uniswapV3GraphQLTicksQueryResponse =
        (await theGraphUniswapV3Client.query({
          query: UniswapTicksQuery,
          variables: {
            poolAddress: poolAddress,
            minTick: minTick,
            maxTick: maxTick,
          },
        })) as ApolloQueryResult<UniswapV3GraphQLTicksQueryResponse>;

      if (mounted) {
        if (!uniswapV3GraphQLTicksQueryResponse.data.pools) return;
        const poolLiquidityData =
          uniswapV3GraphQLTicksQueryResponse.data.pools[0];

        const token0Decimals = Number(poolLiquidityData.token0.decimals);
        const token1Decimals = Number(poolLiquidityData.token1.decimals);
        const decimalFactor = new Big(10 ** (token1Decimals - token0Decimals));

        const currentLiquidity = new Big(poolLiquidityData.liquidity);
        const currentTick = Number(poolLiquidityData.tick);
        const rawTicksData = poolLiquidityData.ticks;

        const tickDataLeft: TickData[] = [];
        const tickDataRight: TickData[] = [];

        // console.log('Current Tick:');
        // console.log(currentTick);

        // MARK -- filling out data for ticks *above* the current tick
        let liquidity = currentLiquidity;
        let splitIdx = rawTicksData.length;

        for (let i = 0; i < rawTicksData.length; i += 1) {
          const rawTickData = rawTicksData[i];
          const tick = Number(rawTickData.tickIdx);
          if (tick <= currentTick) continue;

          // remember the first index above current tick so that search below current tick is more efficient
          if (i < splitIdx) splitIdx = i;

          liquidity = liquidity.plus(new Big(rawTickData.liquidityNet));
          const price0 = new Big(rawTickData.price0);
          const price1 = new Big(rawTickData.price1);

          const sqrtPL = price0.sqrt();
          const sqrtPU = price0.mul(new Big(1.0001).pow(poolBasics.tickSpacing)).sqrt();
          const amount0 = liquidity
            .mul(ONE.div(sqrtPL).minus(ONE.div(sqrtPU)))
            .div(10 ** token0Decimals)
            .toNumber();

          tickDataRight.push({
            tick,
            liquidity,
            amount0: amount0,
            amount1: 0,
            price1In0: price1.mul(decimalFactor).toNumber(),
            price0In1: price0.div(decimalFactor).toNumber(),
            totalValueIn0: amount0,
          });
        }

        // MARK -- filling out data for ticks *below* the current tick
        liquidity = currentLiquidity;

        for (let i = splitIdx - 1; i >= 0; i -= 1) {
          const rawTickData = rawTicksData[i];
          const tick = Number(rawTickData.tickIdx);
          if (tick > currentTick) continue;

          liquidity = liquidity.minus(new Big(rawTickData.liquidityNet));
          const price0 = new Big(rawTickData.price0);
          const price1 = new Big(rawTickData.price1);

          const sqrtPL = price0.sqrt();
          const sqrtPU = price0.mul(new Big(1.0001).pow(poolBasics.tickSpacing)).sqrt();
          const amount1 = liquidity
            .mul(sqrtPU.minus(sqrtPL))
            .div(10 ** token1Decimals)
            .toNumber();

          if (i === splitIdx - 1) {
            // console.log(tick);
            // console.log(liquidity.toFixed(3));
            // console.log(price0.toFixed(0));
          }

          tickDataLeft.push({
            tick,
            liquidity,
            amount0: 0,
            amount1: amount1,
            price1In0: price1.mul(decimalFactor).toNumber(),
            price0In1: price0.div(decimalFactor).toNumber(),
            totalValueIn0: amount1 * price1.mul(decimalFactor).toNumber(),
          });
        }

        const tickData = tickDataLeft
          .reverse()
          .concat(...tickDataRight);
        setLiquidityData(tickData);
        setIsLiquidityDataLoading(false);
      }
    }

    fetch('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640');
    return () => {
      mounted = false;
    };
  });

  useEffect(() => {
    let mounted = true;
    if (uniswapPoolBasics == null || token0 == null || token1 == null) return;
    const tickSpacing = uniswapPoolBasics.tickSpacing;
    const tickOffset = Math.floor(BINS_TO_FETCH * tickSpacing / 2);
    const minTick = roundDownToNearestN(uniswapPoolBasics.slot0.tick - tickOffset, tickSpacing);
    const maxTick = roundUpToNearestN(uniswapPoolBasics.slot0.tick + tickOffset, tickSpacing);
    const minPrice = tickToPrice(isToken0Selected ? minTick : maxTick, token0.decimals, token1.decimals, isToken0Selected);
    const maxPrice = tickToPrice(isToken0Selected ? maxTick : minTick, token0.decimals, token1.decimals, isToken0Selected);
    if (mounted) {
      setTickInfo({
        tickSpacing: tickSpacing,
        minTick: minTick,
        maxTick: maxTick,
        minPrice: parseFloat(minPrice),
        maxPrice: parseFloat(maxPrice),
      });
    }
    const lowerTick = roundDownToNearestN(minTick + (tickOffset / 2), tickSpacing);
    const upperTick = roundUpToNearestN(maxTick - (tickOffset / 2), tickSpacing);
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
      {chartData.length > 0 && (
        <LiquidityChart
          data={chartData}
          rangeStart={lower.price}
          rangeEnd={upper.price}
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
              setLower({
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
              setLowerDebounced({
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
              setLowerDebounced({
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
              setUpper({
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
              setUpperDebounced({
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
              setUpperDebounced({
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
          onChange={setToken0Amount}
        />
        <TokenAmountInput
          tokenLabel={token1?.ticker || ''}
          value={token1Amount}
          onChange={setToken1Amount}
        />
      </div>
    </BaseActionCard>
  );
}
