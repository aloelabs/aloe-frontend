import { useContext, useEffect, useState } from 'react';

import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useEffectOnce from 'shared/lib/data/hooks/UseEffectOnce';
import styled from 'styled-components';
import { useProvider } from 'wagmi';

import { ChainContext } from '../../App';
import { TickData, calculateTickData, fetchUniswapPoolBasics } from '../../data/Uniswap';
import LiquidityChartTooltip from './LiquidityChartTooltip';

export type ChartEntry = {
  price: number;
  liquidityDensity: number;
};

const CHART_HEIGHT = 160;
const ZOOM = 1.15;

const Wrapper = styled.div`
  position: relative;
  width: 100%;
  height: 160px;
  margin-bottom: -15px;
`;

const ChartWrapper = styled.div`
  position: absolute;
  width: 300px;
  top: 0;
  left: -16px;
`;

export type LiquidityChartProps = {
  poolAddress: string;
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
};

export default function LiquidityChart(props: LiquidityChartProps) {
  const { poolAddress, currentPrice, minPrice, maxPrice } = props;
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider();
  const [liquidityData, setLiquidityData] = useState<TickData[] | null>(null);
  const [chartData, setChartData] = useState<{ price: number; liquidityDensity: number }[] | null>(null);

  // Fetch (a) uniswapPoolBasics from ethers and (b) liquidityData from TheGraph
  useEffectOnce(() => {
    let mounted = true;
    async function fetch(poolAddress: string) {
      const poolBasics = await fetchUniswapPoolBasics(poolAddress, provider);
      const tickData = await calculateTickData(poolAddress, poolBasics, activeChain.id);
      if (mounted) {
        setLiquidityData(tickData);
      }
    }
    fetch(poolAddress);
    return () => {
      mounted = false;
    };
  });

  // Once liquidityData has been fetched, arrange/format it to be workable chartData
  useEffect(() => {
    if (liquidityData == null) return;
    const cutoffLeft = Math.min(minPrice, currentPrice) / ZOOM;
    const cutoffRight = Math.max(maxPrice, currentPrice) * ZOOM;

    const chartData: { price: number; liquidityDensity: number }[] = [];
    let minValue = Number.MAX_VALUE;
    let maxValue = 0;

    for (const element of liquidityData) {
      const price = element.price0In1;
      let liquidityDensity = element.totalValueIn0;

      if (liquidityDensity <= 0) continue;
      if (price < cutoffLeft || price > cutoffRight) continue;

      liquidityDensity = Math.log10(liquidityDensity);
      minValue = Math.min(minValue, liquidityDensity);
      maxValue = Math.max(maxValue, liquidityDensity);

      chartData.push({ price, liquidityDensity });
    }

    chartData.forEach((el) => (el.liquidityDensity = el.liquidityDensity - minValue));
    setChartData(chartData);
  }, [liquidityData, minPrice, maxPrice, currentPrice]);

  if (chartData == null || chartData.length < 3) return null;
  const lowestPrice = chartData[0].price;
  const highestPrice = chartData[chartData.length - 1].price;

  const width = highestPrice - lowestPrice;
  const lower = (minPrice - lowestPrice) / width;
  const upper = (maxPrice - lowestPrice) / width;
  const current = (currentPrice - lowestPrice) / width;

  // let gradient: JSX.Element;
  // if (currentPrice < minPrice) {
  //   gradient = (
  //     <linearGradient id='splitColor' x1='0' y1='0' x2='1' y2='0'>
  //       <stop offset={current} stopColor='red' stopOpacity={0.5} />
  //       <stop offset={current} stopColor='blue' stopOpacity={0.5} />
  //       <stop offset={lower} stopColor='blue' stopOpacity={0.5} />
  //       <stop offset={lower} stopColor='blue' stopOpacity={1} />
  //       <stop offset={upper} stopColor='blue' stopOpacity={1} />
  //       <stop offset={upper} stopColor='blue' stopOpacity={0.5} />
  //     </linearGradient>
  //   );
  // } else if (currentPrice < maxPrice) {
  //   gradient = (
  //     <linearGradient id='splitColor' x1='0' y1='0' x2='1' y2='0'>
  //       <stop offset={lower} stopColor='gray' stopOpacity={1} />
  //       <stop offset={lower} stopColor='red' stopOpacity={1} />
  //       <stop offset={current} stopColor='red' stopOpacity={1} />
  //       <stop offset={current} stopColor='blue' stopOpacity={1} />
  //       <stop offset={upper} stopColor='blue' stopOpacity={1} />
  //       <stop offset={upper} stopColor='gray' stopOpacity={1} />
  //     </linearGradient>
  //   );
  // } else {
  //   gradient = (
  //     <linearGradient id='splitColor' x1='0' y1='0' x2='1' y2='0'>
  //       <stop offset={lower} stopColor='gray' stopOpacity={1} />
  //       <stop offset={lower} stopColor='red' stopOpacity={1} />
  //       <stop offset={upper} stopColor='red' stopOpacity={1} />
  //       <stop offset={upper} stopColor='gray' stopOpacity={1} />
  //     </linearGradient>
  //   )
  // }

  return (
    <Wrapper>
      <ChartWrapper>
        <ResponsiveContainer width='100%' height='100%'>
          <div>
            <AreaChart
              data={chartData}
              width={300}
              height={CHART_HEIGHT}
              margin={{
                top: 0,
                right: 0,
                left: 0,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient id='positionHighlight' x1='0' y1='0' x2='1' y2='0'>
                  <stop offset={lower} stopColor='white' stopOpacity={0.0} />
                  <stop offset={lower} stopColor='white' stopOpacity={0.5} />
                  <stop offset={upper} stopColor='white' stopOpacity={0.5} />
                  <stop offset={upper} stopColor='white' stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id='currentPriceSplit' x1='0' y1='0' x2='1' y2='0'>
                  <stop offset={current} stopColor='red' stopOpacity={1} />
                  <stop offset={current} stopColor='blue' stopOpacity={1} />
                </linearGradient>
                <pattern
                  id='stripes'
                  width='10'
                  height='10'
                  patternUnits='userSpaceOnUse'
                  patternTransform='rotate(45)'
                >
                  <line x1='0' y='0' x2='0' y2='10' stroke='white' stroke-width='10' />
                </pattern>
                <mask id='stripesMask'>
                  <rect x='0' y='0' width='100%' height='100%' fill='url(#stripes)' />
                </mask>
                <pattern id='areaFill' width='100%' height='100%' patternUnits='userSpaceOnUse'>
                  <rect
                    x='0'
                    y='0'
                    width='100%'
                    height='100%'
                    fill='url(#positionHighlight)'
                    mask='url(#stripesMask)'
                  />
                </pattern>
              </defs>
              <YAxis hide={true} type='number' domain={['dataMin', (dataMax: number) => dataMax * 1.25]} />
              <Area
                type='monotone'
                dataKey='liquidityDensity'
                stroke='url(#currentPriceSplit)'
                strokeWidth='3'
                fill='url(#areaFill)'
                fillOpacity={1.0}
                activeDot={true}
              />
              <ReferenceLine x={currentPrice} stroke='white' strokeWidth='1' />
              <Tooltip
                isAnimationActive={false}
                content={(props: any) => {
                  return (
                    <LiquidityChartTooltip
                      active={props?.active ?? false}
                      selectedPrice={props?.payload[0]?.payload.price}
                      currentPrice={currentPrice}
                      x={props?.coordinate?.x ?? 0}
                    />
                  );
                }}
              />
              <XAxis dataKey='price' type='number' domain={[lowestPrice, highestPrice]} tick={false} height={0} />
            </AreaChart>
          </div>
        </ResponsiveContainer>
      </ChartWrapper>
    </Wrapper>
  );
}
