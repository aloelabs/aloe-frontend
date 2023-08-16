import { useContext, useEffect, useMemo, useState } from 'react';

import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useEffectOnce from 'shared/lib/data/hooks/UseEffectOnce';
import styled from 'styled-components';

import { ChainContext } from '../../App';
import { TickData, calculateTickData } from '../../data/Uniswap';
import { LiquidityChartPlaceholder } from './LiquidityChartPlaceholder';
import LiquidityChartTooltip from './LiquidityChartTooltip';

type ChartEntry = {
  tick: number;
  liquidityDensity: number;
};

type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const CHART_WIDTH = 300;
const CHART_HEIGHT = 160;

const Wrapper = styled.div`
  position: relative;
  width: 100%;
  height: 160px;
  margin-bottom: -15px;
`;

const ChartWrapper = styled.div`
  position: absolute;
  width: ${CHART_WIDTH}px;
  top: 0;
  left: -16px;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  overflow: hidden;
`;

function calculateYPosition(tick: number, chartData: ChartEntry[] | null) {
  if (chartData == null) return 0;
  let minTickError = Number.MAX_VALUE;
  let nearestLiquidity = chartData[0].liquidityDensity;

  let minValue = Number.MAX_VALUE;
  let maxValue = 0;
  chartData.forEach((el) => {
    minValue = Math.min(minValue, el.liquidityDensity);
    maxValue = Math.max(maxValue, el.liquidityDensity);

    const tickError = Math.abs(tick - el.tick);
    if (tickError < minTickError) {
      minTickError = tickError;
      nearestLiquidity = el.liquidityDensity;
    }
  });

  const dataRange = maxValue - minValue;
  const graphBottom = minValue - dataRange / 4;
  const graphTop = maxValue + dataRange / 8;

  return CHART_HEIGHT - ((nearestLiquidity - graphBottom) * CHART_HEIGHT) / (graphTop - graphBottom);
}

function MinIconLabel(x: number, y: number) {
  return (
    <g>
      <svg width='24' height='36' viewBox='0 0 24 36' fill='none' x={x - 24 / 2} y={y - 24}>
        <path d='M12 36L3.5 20.5L1 9H23L20.5 20.5L12 36Z' fill='white' />
        <circle cx='12' cy='12' r='11' fill='black' stroke='white' stroke-width='2' />
        <path d='M19 12L14 9.11325V14.8868L19 12ZM10 12.5H14.5V11.5H10V12.5Z' fill='white' />
        <line x1='9.5' y1='7' x2='9.5' y2='17' stroke='white' />
      </svg>
    </g>
  );
}

function MaxIconLabel(x: number, y: number) {
  return (
    <g>
      <svg width='24' height='36' viewBox='0 0 24 36' fill='none' x={x - 24 / 2} y={y - 24}>
        <path d='M12 36L3.5 20.5L1 9H23L20.5 20.5L12 36Z' fill='white' />
        <circle cx='12' cy='12' r='11' fill='black' stroke='white' stroke-width='2' />
        <path d='M5 12L10 14.8868V9.11325L5 12ZM9.5 12.5H14V11.5H9.5V12.5Z' fill='white' />
        <line x1='14.5' y1='7' x2='14.5' y2='17' stroke='white' />
      </svg>
    </g>
  );
}

export type LiquidityChartProps = {
  poolAddress: string;
  currentTick: number;
  minTick: number;
  maxTick: number;
  color0: string;
  color1: string;
  uniqueId: string;
};

export default function LiquidityChart(props: LiquidityChartProps) {
  const { poolAddress, currentTick, minTick, maxTick, color0, color1, uniqueId } = props;
  const { activeChain } = useContext(ChainContext);
  const [liquidityData, setLiquidityData] = useState<TickData[] | null>(null);
  const [chartData, setChartData] = useState<ChartEntry[] | null>(null);

  // Fetch (a) uniswapPoolBasics from ethers and (b) liquidityData from TheGraph
  useEffectOnce(() => {
    let mounted = true;
    async function fetch(poolAddress: string) {
      const tickData = await calculateTickData(poolAddress, activeChain.id);
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

    // Make sure graph shows position bounds (both lower and upper) and the current tick
    let cutoffLeft = Math.min(minTick, currentTick);
    let cutoffRight = Math.max(maxTick, currentTick);
    // Zoom out a bit to make things prettier
    const positionWidth = maxTick - minTick;
    cutoffLeft -= positionWidth;
    cutoffRight += positionWidth;

    const newChartData: ChartEntry[] = [];
    let minValue = Number.MAX_VALUE;
    let maxValue = 0;

    for (const element of liquidityData) {
      const tick = element.tick;
      let liquidityDensity = element.liquidity.toNumber();

      if (liquidityDensity <= 0) continue;
      if (tick < cutoffLeft || tick > cutoffRight) continue;

      minValue = Math.min(minValue, liquidityDensity);
      maxValue = Math.max(maxValue, liquidityDensity);

      newChartData.push({ tick, liquidityDensity });
    }

    const range = maxValue - minValue;
    newChartData.forEach((el) => (el.liquidityDensity = el.liquidityDensity - minValue + range / 8));
    setChartData(newChartData);
  }, [liquidityData, minTick, maxTick, currentTick]);

  const minTickY = useMemo(() => calculateYPosition(minTick, chartData), [minTick, chartData]);
  const maxTickY = useMemo(() => calculateYPosition(maxTick, chartData), [maxTick, chartData]);

  if (chartData == null || chartData.length < 3) return <LiquidityChartPlaceholder />;

  const lowestTick = chartData[0].tick;
  const highestTick = chartData[chartData.length - 1].tick;

  const domain = highestTick - lowestTick;
  const lower = (minTick - lowestTick) / domain;
  const upper = (maxTick - lowestTick) / domain;
  const current = (currentTick - lowestTick) / domain;

  let positionHighlight: JSX.Element;
  const positionHighlightId = 'positionHighlight'.concat(uniqueId);
  if (currentTick < minTick) {
    positionHighlight = (
      <linearGradient id={positionHighlightId} x1='0' y1='0' x2='1' y2='0'>
        <stop offset={lower} stopColor='white' stopOpacity={0.0} />
        <stop offset={lower} stopColor={color0} stopOpacity={0.5} />
        <stop offset={upper} stopColor={color0} stopOpacity={0.5} />
        <stop offset={upper} stopColor='white' stopOpacity={0.0} />
      </linearGradient>
    );
  } else if (currentTick < maxTick) {
    positionHighlight = (
      <linearGradient id={positionHighlightId} x1='0' y1='0' x2='1' y2='0'>
        <stop offset={lower} stopColor='white' stopOpacity={0.0} />
        <stop offset={lower} stopColor={color1} stopOpacity={0.5} />
        <stop offset={current} stopColor={color1} stopOpacity={0.5} />
        <stop offset={current} stopColor={color0} stopOpacity={0.5} />
        <stop offset={upper} stopColor={color0} stopOpacity={0.5} />
        <stop offset={upper} stopColor='white' stopOpacity={0} />
      </linearGradient>
    );
  } else {
    positionHighlight = (
      <linearGradient id={positionHighlightId} x1='0' y1='0' x2='1' y2='0'>
        <stop offset={lower} stopColor='white' stopOpacity={0.0} />
        <stop offset={lower} stopColor={color1} stopOpacity={0.5} />
        <stop offset={upper} stopColor={color1} stopOpacity={0.5} />
        <stop offset={upper} stopColor='white' stopOpacity={0.0} />
      </linearGradient>
    );
  }

  return (
    <Wrapper>
      <ChartWrapper>
        <ResponsiveContainer width='100%' height='100%'>
          <div>
            <AreaChart
              data={chartData}
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              margin={{
                top: 0,
                right: 0,
                left: 0,
                bottom: 0,
              }}
            >
              <defs>
                {positionHighlight}
                <linearGradient id={'currentPriceSplit'.concat(uniqueId)} x1='0' y1='0' x2='1' y2='0'>
                  <stop offset={current} stopColor={color1} stopOpacity={1} />
                  <stop offset={current} stopColor={color0} stopOpacity={1} />
                </linearGradient>
                <pattern
                  id='stripes'
                  width='10'
                  height='10'
                  patternUnits='userSpaceOnUse'
                  patternTransform='rotate(45)'
                >
                  <line x1='0' y='0' x2='0' y2='10' stroke='white' strokeWidth='10' />
                </pattern>
                <mask id='stripesMask'>
                  <rect x='0' y='0' width='100%' height='100%' fill='url(#stripes)' />
                </mask>
                <pattern id={'areaFill'.concat(uniqueId)} width='100%' height='100%' patternUnits='userSpaceOnUse'>
                  <rect
                    x='0'
                    y='0'
                    width='100%'
                    height='100%'
                    fill={'url(#'.concat(positionHighlightId, ')')}
                    // mask='url(#stripesMask)'
                  />
                </pattern>
              </defs>
              <XAxis dataKey='tick' type='number' domain={[lowestTick, highestTick]} tick={false} height={0} />
              <YAxis
                hide={true}
                type='number'
                domain={([dataMin, dataMax]: [number, number]) => {
                  const range = dataMax - dataMin;
                  return [dataMin - range / 8, dataMax + range / 4];
                }}
              />
              <Area
                type='stepAfter'
                dataKey='liquidityDensity'
                stroke={'url(#currentPriceSplit'.concat(uniqueId, ')')}
                strokeWidth='3'
                fill={'url(#areaFill'.concat(uniqueId, ')')}
                fillOpacity={1.0}
                activeDot={{
                  fill: '#ccc',
                  stroke: '#ccc',
                  r: 3,
                }}
                isAnimationActive={false}
              />
              <ReferenceLine
                x={minTick}
                stroke='transparent'
                strokeWidth='1'
                label={({ viewBox }: { viewBox: ViewBox }) => {
                  return MinIconLabel(viewBox.x, minTickY);
                }}
              />
              <ReferenceLine
                x={maxTick}
                stroke='transparent'
                strokeWidth='1'
                label={({ viewBox }: { viewBox: ViewBox }) => {
                  return MaxIconLabel(viewBox.x, maxTickY);
                }}
              />
              <ReferenceLine x={currentTick} stroke='white' strokeWidth='1' />
              <Tooltip
                isAnimationActive={false}
                content={(props: any) => {
                  return (
                    <LiquidityChartTooltip
                      active={props?.active ?? false}
                      selectedTick={props?.payload[0]?.payload.tick}
                      currentTick={currentTick}
                      x={props?.coordinate?.x ?? 0}
                      chartWidth={CHART_WIDTH}
                    />
                  );
                }}
              />
            </AreaChart>
          </div>
        </ResponsiveContainer>
      </ChartWrapper>
    </Wrapper>
  );
}
