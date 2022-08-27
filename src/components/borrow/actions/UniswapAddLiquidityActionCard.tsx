import { useEffect, useState } from 'react';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, ActionProviders } from '../../../data/Actions';
import SteppedInput from '../LiquidityChartRangeInput/SteppedInput';
import LiquidityChart from '../LiquidityChartRangeInput/LiquidityChart';
import { theGraphUniswapV3Client } from '../../../App';
import { UniswapTicksQuery } from '../../../util/GraphQL';
import { ApolloQueryResult } from '@apollo/react-hooks';
import Big from 'big.js';

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

const ONE = new Big('1.0');

function calculateNearestPrice(price: number, data: TickData[]): PriceIndex {
  const nearest: TickData = data.reduce((prev: TickData, cur: TickData) => {
    const prevDifference = Math.abs(prev.price1In0 - price);
    const curDifference = Math.abs(cur.price1In0 - price);
    return curDifference < prevDifference ? cur : prev;
  });
  return {
    price: nearest.price1In0.toString(),
    //TODO: look into to avoiding having to use indexOf
    index: data.indexOf(nearest),
  };
}

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
  const [chartData, setChartData] = useState<TickData[]>([]);

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

        console.log('Current Tick:');
        console.log(currentTick);

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
            console.log(tick);
            console.log(liquidity.toFixed(3));
            console.log(price0.toFixed(0));
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

        //TODO: temporarily splicing data
        const tickData = tickDataLeft
          .reverse()
          .concat(...tickDataRight)
          .splice(500);
        const reversedTickData = [...tickData].reverse();
        setChartData(reversedTickData);
        if (reversedTickData.length > 0) {
          setLower({
            price:
              reversedTickData[
                Math.floor(reversedTickData.length / 4)
              ].price1In0.toString(),
            index: Math.floor(reversedTickData.length / 4),
          });
          setUpper({
            price:
              reversedTickData[
                Math.floor(reversedTickData.length / 4) +
                  Math.floor(reversedTickData.length / 2)
              ].price1In0.toString(),
            index:
              Math.floor(reversedTickData.length / 4) +
              Math.floor(reversedTickData.length / 2),
          });
        }
      }
    }

    fetch('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', 200000, 210000, 10);
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <BaseActionCard
      action={ActionProviders.UniswapV3.actions.ADD_LIQUIDITY.name}
      actionProvider={ActionProviders.UniswapV3}
      onRemove={onRemove}
    >
      {chartData.length > 0 && (
        <LiquidityChart
          data={chartData}
          rangeStart={lower.index}
          rangeEnd={upper.index}
        />
      )}
      <div className='flex flex-row gap-2'>
        <SteppedInput
          value={lower.price}
          label='Min Price'
          token0={token0}
          token1={token1}
          onChange={(value) => {
            const nearest = calculateNearestPrice(parseInt(value), chartData);
            if (nearest.index < upper.index) {
              setLower({
                price: nearest.price,
                index: nearest.index,
              });
            }
          }}
          onDecrement={() => {
            if (lower.index > 0) {
              setLower({
                price: chartData[lower.index - 1].price1In0.toString(),
                index: lower.index - 1,
              });
            }
          }}
          onIncrement={() => {
            if (lower.index + 1 < upper.index) {
              setLower({
                price: chartData[lower.index + 1].price1In0.toString(),
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
            const nearest = calculateNearestPrice(parseInt(value), chartData);
            if (nearest.index > lower.index) {
              setUpper({
                price: nearest.price,
                index: nearest.index,
              });
            }
          }}
          onDecrement={() => {
            if (upper.index - 1 > 0 && upper.index - 1 > lower.index) {
              setUpper({
                price: chartData[upper.index - 1].price1In0.toString(),
                index: upper.index - 1,
              });
            }
          }}
          onIncrement={() => {
            if (upper.index < chartData.length) {
              setUpper({
                price: chartData[upper.index + 1].price1In0.toString(),
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
    </BaseActionCard>
  );
}
