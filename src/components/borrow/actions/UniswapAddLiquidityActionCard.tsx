import { useEffect, useState } from 'react';
import { FilledGradientButton, FilledGreyButton } from '../../common/Buttons';
import { Dropdown } from '../../common/Dropdown';
import TokenAmountInput from '../../common/TokenAmountInput';
import { BaseActionCard } from '../BaseActionCard';
import { ActionCardProps, ActionProviders } from '../../../data/Actions';
import { GetTokenData } from '../../../data/TokenData';
import SteppedInput from '../LiquidityChartRangeInput/SteppedInput';
import LiquidityChart, { ChartEntry } from '../LiquidityChartRangeInput/LiquidityChart';
import { theGraphUniswapV3Client } from '../../../App';
import { UniswapTicksQuery } from '../../../util/GraphQL';
import { ApolloQueryResult } from '@apollo/react-hooks';
import Big from 'big.js';

type UniswapV3GraphQLTick = {
  tickIdx: string,
  liquidityNet: string,
  price0: string,
  price1: string,
  __typename: string,
};

type UniswapV3GraphQLTicksQueryResponse = {
  pools: {
    token0: { decimals: string },
    token1: { decimals: string },
    liquidity: string,
    tick: string,
    ticks: UniswapV3GraphQLTick[],
    __typename: string
  }[],
}

type TickData = {
  tick: number,
  liquidity: Big,
  amount0: number,
  amount1: number,
  price1In0: number,
  price0In1: number
}[];

export const UNISWAP_V3_PAIRS = [
  {
    name: 'USDC/WETH',
    token0: GetTokenData('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
    token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
  },
  {
    name: 'WBTC/WETH',
    token0: GetTokenData('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'),
    token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
  },
];

function calcuateLiquidity(index: number, total: number) {
  const distanceToMiddle = Math.abs(index - total / 2);
  const distanceFromMiddle = total - distanceToMiddle;
  return (
    Math.random() * distanceFromMiddle * distanceFromMiddle * distanceFromMiddle
  );
}

const ONE = new Big("1.0");

let fakeData: Array<ChartEntry> = [];

for (let i = 0; i < 250; i++) {
  fakeData.push({
    index: i,
    isCurrent: i === 125,
    activeLiquidity: calcuateLiquidity(i, 250),
    price0: i * 0.1,
    price1: i * 8 + 1000 + Math.random(),
  });
}

function calculateNearest(value: number, data: ChartEntry[]): ChartEntry {
  const nearest = data.reduce((prev, curr) => {
    const prevDiff = Math.abs(prev.price1 - value);
    const currDiff = Math.abs(curr.price1 - value);
    return prevDiff < currDiff ? prev : curr;
  });
  return nearest;
}

export default function UniswapAddLiquidityActionCard(props: ActionCardProps) {
  const { token0, token1, previousActionCardState, onChange, onRemove } = props;
  const [lower, setLower] = useState({
    price: fakeData[0].price1.toString(),
    index: 0,
  });
  const [upper, setUpper] = useState({
    price: fakeData[fakeData.length - 1].price1.toString(),
    index: fakeData.length - 1,
  });

  useEffect(() => {
    let mounted = true;
    async function fetch(poolAddress: string, minTick: number, maxTick: number, tickSpacing: number) {
      const uniswapV3GraphQLTicksQueryResponse = await theGraphUniswapV3Client.query({
        query: UniswapTicksQuery,
        variables: {
          poolAddress: poolAddress,
          minTick: minTick,
          maxTick: maxTick,
        },
      }) as ApolloQueryResult<UniswapV3GraphQLTicksQueryResponse>;

      if (mounted) {
        if (!uniswapV3GraphQLTicksQueryResponse.data.pools) return;
        const poolLiquidityData = uniswapV3GraphQLTicksQueryResponse.data.pools[0];

        const token0Decimals = Number(poolLiquidityData.token0.decimals);
        const token1Decimals = Number(poolLiquidityData.token1.decimals);
        const decimalFactor = new Big(10 ** (token1Decimals - token0Decimals));

        const currentLiquidity = new Big(poolLiquidityData.liquidity);
        const currentTick = Number(poolLiquidityData.tick);
        const rawTicksData = poolLiquidityData.ticks;

        const tickDataLeft: TickData = [];
        const tickDataRight: TickData = [];

        console.log("Current Tick:");
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

          const pL = price0;
          const pU = pL.mul(new Big(1.0001).pow(tickSpacing));

          tickDataRight.push({
            tick,
            liquidity,
            amount0: liquidity.mul(ONE.div(pL.sqrt()).minus(ONE.div(pU.sqrt()))).div(10 ** token0Decimals).toNumber(),
            amount1: 0,
            price1In0: price1.mul(decimalFactor).toNumber(),
            price0In1: price0.div(decimalFactor).toNumber(),
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

          const pL = price0;
          const pU = pL.mul(new Big(1.0001).pow(tickSpacing));

          if (i==splitIdx - 1) {
            console.log(tick);
            console.log(liquidity.toFixed(3));
            console.log(price0.toFixed(0));
          }

          tickDataLeft.push({
            tick,
            liquidity,
            amount0: 0,
            amount1: liquidity.mul(pU.sqrt().minus(pL.sqrt())).div(10 ** token1Decimals).toNumber(),
            price1In0: price1.mul(decimalFactor).toNumber(),
            price0In1: price0.div(decimalFactor).toNumber(),
          });
        }

        const tickData = tickDataLeft.reverse().concat(...tickDataRight);
        console.log(tickData);
      }
    }

    fetch("0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640", 200000, 210000, 10);
    return () => {
      mounted = false;
    }
  }, []);

  return (
    <BaseActionCard
      action={ActionProviders.UniswapV3.actions.ADD_LIQUIDITY.name}
      actionProvider={ActionProviders.UniswapV3}
      onRemove={onRemove}
    >
      <LiquidityChart
        data={fakeData}
        rangeStart={parseInt(lower.price)}
        rangeEnd={parseInt(upper.price)}
      />
      <div className='flex flex-row gap-2'>
        <SteppedInput
          value={lower.price}
          label='Min Price'
          token0={token0}
          token1={token1}
          onChange={(value) => {
            const nearest = calculateNearest(parseInt(value), fakeData);
            setLower({
              price: nearest.price1.toString(),
              index: nearest.index,
            });
          }}
          onDecrement={() => {
            // setLower((parseFloat(lower) - 1).toString());
          }}
          onIncrement={() => {
            // setUpper((parseFloat(upper) + 1).toString());
          }}
          // decrementDisabled={
            // lower === '' || parseFloat(lower) <= decrementStep
          // }
          // incrementDisabled={upper === ''}
        />
        <SteppedInput
          value={upper.price}
          label='Max Price'
          token0={token0}
          token1={token1}
          onChange={(value) => {
            const nearest = calculateNearest(parseInt(value), fakeData);
            setUpper({
              price: nearest.price1.toString(),
              index: nearest.index,
            });
          }}
          onDecrement={() => {
            // setAmount1((parseFloat(amount1) - 1).toString());
          }}
          onIncrement={() => {
            // setAmount1((parseFloat(amount1) + 1).toString());
          }}
          // decrementDisabled={
          //   amount0 === '' || parseFloat(amount1) <= decrementStep
          // }
          // incrementDisabled={amount1 === ''}
        />
      </div>
    </BaseActionCard>
  );
}
