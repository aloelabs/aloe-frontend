import { useEffect, useState } from 'react';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, ActionProviders } from '../../../data/Actions';
import SteppedInput from '../LiquidityChartRangeInput/SteppedInput';
import LiquidityChart, {
  ChartEntry,
} from '../LiquidityChartRangeInput/LiquidityChart';
import { theGraphUniswapV3Client } from '../../../App';
import { UniswapTicksQuery } from '../../../util/GraphQL';
import { ApolloQueryResult } from '@apollo/react-hooks';
import Big from 'big.js';
import TokenAmountInput from '../../common/TokenAmountInput';
import TokenChooser from '../../common/TokenChooser';
import styled from 'styled-components';
import tw from 'twin.macro';
import { ReactComponent as GearIcon } from '../../../assets/svg/gear.svg';

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

export type TickData = {
  tick: number;
  liquidity: Big;
  amount0: number;
  amount1: number;
  price1In0: number;
  price0In1: number;
  totalValueIn0: number;
};

type PriceIndex = {
  price: string;
  index: number;
};

//Debouncing helps us avoid maxing out cpu usage
const DEBOUNCE_DELAY = 150;
const ONE = new Big('1.0');

function calculateNearestPrice(price: number, data: ChartEntry[]): PriceIndex {
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
    index: data.indexOf(nearest),
  };
}

const SvgButtonWrapper = styled.button`
  ${tw`flex justify-center items-center`}
  height: max-content;
  width: max-content;
  margin-top: auto;
  margin-bottom: auto;
  background-color: transparent;
  border-radius: 2px;
  padding: 8px;
  svg {
    path {
      stroke: #fff;
    }
  }
`;

export default function UniswapAddLiquidityActionCard(props: ActionCardProps) {
  const { token0, token1, previousActionCardState, onChange, onRemove } = props;
  const [lower, setLower] = useState<PriceIndex>({
    price: '',
    index: 0,
  });
  const [upper, setUpper] = useState<PriceIndex>({
    price: '',
    index: 0,
  });
  const [token0Amount, setToken0Amount] = useState('');
  const [token1Amount, setToken1Amount] = useState('');
  const [isToken0Selected, setToken0Selected] = useState(false);
  const [isLiquidityDataLoading, setIsLiquidityDataLoading] = useState(true);
  const [liquidityData, setLiquidityData] = useState<TickData[]>([]);
  const [chartData, setChartData] = useState<ChartEntry[]>([]);

  useEffect(() => {
    let mounted = true;
    async function fetch(
      poolAddress: string,
      minTick: number,
      maxTick: number,
      tickSpacing: number
    ) {
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
          const sqrtPU = price0.mul(new Big(1.0001).pow(tickSpacing)).sqrt();
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
          const sqrtPU = price0.mul(new Big(1.0001).pow(tickSpacing)).sqrt();
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

    fetch('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', 200000, 210000, 10);
    return () => {
      mounted = false;
    };
  }, []);

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
    if (updatedChartData.length > 4) {
      setLower({
        price:
          updatedChartData[
            Math.floor(updatedChartData.length / 4)
          ].price.toString(),
        index: Math.floor(updatedChartData.length / 4),
      });
      setUpper({
        price:
          updatedChartData[
            Math.floor(updatedChartData.length / 4) +
              Math.floor(updatedChartData.length / 2)
          ].price.toString(),
        index:
          Math.floor(updatedChartData.length / 4) +
          Math.floor(updatedChartData.length / 2),
      });
    }
  }, [isLiquidityDataLoading, isToken0Selected, liquidityData]);

  let setLowerTimeout: NodeJS.Timeout;
  let setUpperTimeout: NodeJS.Timeout;

  //TODO: improve debounce logic (possibly move it to only debounce graph rendering if possible)
  function setLowerDebounced(updatedLower: PriceIndex) {
    clearTimeout(setLowerTimeout);
    setLowerTimeout = setTimeout(() => {
      setLower(updatedLower);
    }, DEBOUNCE_DELAY);
  }

  //TODO: improve debounce logic (possibly move it to only debounce graph rendering if possible)
  function setUpperDebounced(updatedUpper: PriceIndex) {
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
            token0Selected={isToken0Selected}
            setToken0Selected={setToken0Selected}
          />
        )}
        <SvgButtonWrapper>
          <GearIcon width={24} height={24} />
        </SvgButtonWrapper>
      </div>
      {chartData.length > 0 && (
        <LiquidityChart
          data={chartData}
          rangeStart={lower.index}
          rangeEnd={upper.index}
        />
      )}
      <div className='flex flex-row gap-2 mb-4'>
        <SteppedInput
          value={lower.price}
          label='Min Price'
          token0={token0}
          token1={token1}
          onChange={(value) => {
            const nearest = calculateNearestPrice(parseFloat(value), chartData);
            if (nearest.index < upper.index) {
              //Don't debounce this
              setLower({
                price: nearest.price,
                index: nearest.index,
              });
            }
          }}
          onDecrement={() => {
            if (lower.index > 0) {
              setLowerDebounced({
                price: chartData[lower.index - 1].price.toString(),
                index: lower.index - 1,
              });
            }
          }}
          onIncrement={() => {
            if (lower.index + 1 < upper.index) {
              setLowerDebounced({
                price: chartData[lower.index + 1].price.toString(),
                index: lower.index + 1,
              });
            }
          }}
          decrementDisabled={lower.price === '' || lower.index <= 0}
          incrementDisabled={
            lower.price === '' ||
            lower.index + 1 >= upper.index ||
            lower.index + 1 === chartData.length
          }
        />
        <SteppedInput
          value={upper.price}
          label='Max Price'
          token0={token0}
          token1={token1}
          onChange={(value) => {
            const nearest = calculateNearestPrice(parseFloat(value), chartData);
            if (nearest.index > lower.index) {
              //Don't debounce this
              setUpper({
                price: nearest.price,
                index: nearest.index,
              });
            }
          }}
          onDecrement={() => {
            if (upper.index - 1 > 0 && upper.index - 1 > lower.index) {
              setUpperDebounced({
                price: chartData[upper.index - 1].price.toString(),
                index: upper.index - 1,
              });
            }
          }}
          onIncrement={() => {
            if (upper.index < chartData.length) {
              setUpperDebounced({
                price: chartData[upper.index + 1].price.toString(),
                index: upper.index + 1,
              });
            }
          }}
          decrementDisabled={
            upper.price === '' || upper.index - 1 <= lower.index
          }
          incrementDisabled={
            upper.price === '' || upper.index + 1 >= chartData.length
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
