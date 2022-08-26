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
    async function fetch(poolAddress: string, minTick: number, maxTick: number) {
      const tickData = await theGraphUniswapV3Client.query({
        query: UniswapTicksQuery,
        variables: {
          poolAddress: poolAddress,
          minTick: minTick,
          maxTick: maxTick,
        },
      });
      if (mounted) {
        console.log(tickData);
      }
    }

    fetch("0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640", 190000, 200000);
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
