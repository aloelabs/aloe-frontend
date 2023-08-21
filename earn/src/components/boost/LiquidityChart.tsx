import { useContext, useEffect, useMemo, useState } from 'react';

import * as Sentry from '@sentry/react';
import Big from 'big.js';
import { Area, AreaChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Text } from 'shared/lib/components/common/Typography';
import { useDebouncedMemo } from 'shared/lib/data/hooks/UseDebouncedMemo';
import useEffectOnce from 'shared/lib/data/hooks/UseEffectOnce';
import styled from 'styled-components';

import { ChainContext } from '../../App';
import { ReactComponent as WarningIcon } from '../../assets/svg/warning.svg';
import { computeLiquidationThresholds, sqrtRatioToTick } from '../../data/BalanceSheet';
import { BoostCardInfo } from '../../data/Uniboost';
import { TickData, calculateTickData } from '../../data/Uniswap';
import { LiquidityChartPlaceholder } from './LiquidityChartPlaceholder';
import LiquidityChartTooltip from './LiquidityChartTooltip';

const LIQUIDATION_THRESHOLDS_DEBOUNCE_MS = 250;
const CHART_WIDTH = 300;
const CHART_HEIGHT = 160;

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

const ChartErrorOverlay = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  width: ${CHART_WIDTH}px;
  height: ${CHART_HEIGHT}px;
  top: 0;
  left: -16px;
  background-color: rgba(0, 0, 0, 0.4);
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  z-index: 1;
  pointer-events: none;
`;

const StyledWarningIcon = styled(WarningIcon)`
  width: 24px;
  height: 24px;

  path {
    fill: #ffffff;
  }
`;

function calculateYPosition(tick: number, chartData: ChartEntry[] | null) {
  if (chartData == null || chartData.length === 0) return 0;
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

  return (
    // if the y position is NaN, default to the middle of the chart
    CHART_HEIGHT - ((nearestLiquidity - graphBottom) * CHART_HEIGHT) / (graphTop - graphBottom) || CHART_HEIGHT / 2 - 16
  );
}

function MinIconLabel(x: number, y: number) {
  return (
    <g>
      <svg width='24' height='36' viewBox='0 0 24 36' fill='none' x={x - 24 / 2} y={y - 24}>
        <path d='M12 36L3.5 20.5L1 9H23L20.5 20.5L12 36Z' fill='white' />
        <circle cx='12' cy='12' r='11' fill='black' stroke='white' strokeWidth='2' />
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
        <circle cx='12' cy='12' r='11' fill='black' stroke='white' strokeWidth='2' />
        <path d='M5 12L10 14.8868V9.11325L5 12ZM9.5 12.5H14V11.5H9.5V12.5Z' fill='white' />
        <line x1='14.5' y1='7' x2='14.5' y2='17' stroke='white' />
      </svg>
    </g>
  );
}

function LiquidationIconLabel(x: number, y: number) {
  return (
    <g>
      <svg width='24' height='36' viewBox='0 0 24 36' fill='none' x={x - 24 / 2} y={y - 24}>
        <path d='M12 36L3.5 20.5L1 9H23L20.5 20.5L12 36Z' fill='white' />
        <circle cx='12' cy='12' r='11' fill='black' stroke='white' strokeWidth='2' />
        <path
          d='M12.9939 14.5935C12.8621 15.7796 11.1379 15.7796
           11.0061 14.5935L10.1234 6.64887C10.0576 6.0565 10.5213
           5.53844 11.1173 5.53844H12.8827C13.4787 5.53844 13.9424
            6.0565 13.8766 6.64887L12.9939 14.5935Z'
          fill='white'
        />
        <circle cx='12' cy='17.5384' r='1' fill='white' />
      </svg>
    </g>
  );
}

export type LiquidityChartProps = {
  info: BoostCardInfo;
  uniqueId: string;
  // Whether or not to show point-of-interest bubbles
  showPOI: boolean;
};

export default function LiquidityChart(props: LiquidityChartProps) {
  const { info, uniqueId, showPOI } = props;
  const { uniswapPool: poolAddress, currentTick, position, color0, color1 } = info;
  const { activeChain } = useContext(ChainContext);
  const [liquidityData, setLiquidityData] = useState<TickData[] | null>(null);
  const [chartData, setChartData] = useState<ChartEntry[] | null>(null);
  const [chartError, setChartError] = useState<boolean>(false);

  // Fetch liquidityData from TheGraph
  useEffectOnce(() => {
    let mounted = true;
    async function fetch(poolAddress: string) {
      let tickData: TickData[] | null = null;
      try {
        tickData = await calculateTickData(poolAddress, activeChain.id);
      } catch (e) {
        Sentry.captureException(e, {
          extra: {
            poolAddress,
            chain: {
              id: activeChain.id,
              name: activeChain.name,
            },
            assets: {
              asset0: {
                symbol: info.token0.symbol,
                address: info.token0.address,
              },
              asset1: {
                symbol: info.token1.symbol,
                address: info.token1.address,
              },
            },
          },
        });
        if (mounted) {
          setChartError(true);
        }
        const cutoffLeft = Math.min(position.lower, currentTick);
        const cutoffRight = Math.max(position.upper, currentTick);
        tickData = [
          {
            tick: cutoffLeft,
            liquidity: new Big(0),
            price0In1: 0,
            price1In0: 0,
          },
          {
            tick: currentTick,
            liquidity: new Big(0),
            price0In1: 0,
            price1In0: 0,
          },
          {
            tick: cutoffRight,
            liquidity: new Big(0),
            price0In1: 0,
            price1In0: 0,
          },
        ];
      }
      if (mounted) {
        setLiquidityData(tickData);
      }
    }
    fetch(poolAddress);
    return () => {
      mounted = false;
    };
  });

  // Compute liquidation thresholds
  const liquidation = useDebouncedMemo(
    () => {
      if (info.borrower == null) return null;
      const sqrtRatios = computeLiquidationThresholds(
        info.borrower.assets,
        info.borrower.liabilities,
        [info.position],
        info.borrower.sqrtPriceX96,
        info.borrower.iv,
        info.token0.decimals,
        info.token1.decimals
      );
      return {
        lower: sqrtRatioToTick(sqrtRatios.lowerSqrtRatio),
        upper: sqrtRatioToTick(sqrtRatios.upperSqrtRatio),
      };
    },
    [info],
    LIQUIDATION_THRESHOLDS_DEBOUNCE_MS
  );

  // Once liquidityData has been fetched, arrange/format it to be workable chartData
  useEffect(() => {
    if (liquidityData == null) return;

    // Make sure graph shows position bounds (both lower and upper) and the current tick
    let cutoffLeft = Math.min(position.lower, currentTick);
    let cutoffRight = Math.max(position.upper, currentTick);
    // Zoom out a bit to make things prettier
    const positionWidth = position.upper - position.lower;
    cutoffLeft -= positionWidth;
    cutoffRight += positionWidth;

    const newChartData: ChartEntry[] = [];
    let minValue = Number.MAX_VALUE;
    let maxValue = 0;

    for (const element of liquidityData) {
      const tick = element.tick;
      let liquidityDensity = element.liquidity.toNumber();

      // Ignore negative values (TheGraph is stupid)
      if (liquidityDensity < 0) continue;
      // Filter out data points that are outside our chosen domain
      if (tick < cutoffLeft || tick > cutoffRight) continue;

      // Update min/max values so we can compute range later on
      minValue = Math.min(minValue, liquidityDensity);
      maxValue = Math.max(maxValue, liquidityDensity);

      // Ensure data points exist for all interesting locations
      if (newChartData.length > 0) {
        const prev = newChartData.at(-1)!;
        // for position.lower
        if (prev.tick < position.lower && position.lower < element.tick) {
          newChartData.push({ tick: position.lower, liquidityDensity: prev.liquidityDensity });
        }
        // for position.upper
        if (prev.tick < position.upper && position.upper < element.tick) {
          newChartData.push({ tick: position.upper, liquidityDensity: prev.liquidityDensity });
        }
        if (liquidation) {
          // for liquidation.lower
          if (prev.tick < liquidation.lower && liquidation.lower < element.tick) {
            newChartData.push({ tick: liquidation.lower, liquidityDensity: prev.liquidityDensity });
          }
          // for liquidation.upper
          if (prev.tick < liquidation.upper && liquidation.upper < element.tick) {
            newChartData.push({ tick: liquidation.upper, liquidityDensity: prev.liquidityDensity });
          }
        }
      }
      // Add the data point
      newChartData.push({ tick, liquidityDensity });
    }

    const range = maxValue - minValue;
    newChartData.forEach((el) => (el.liquidityDensity = el.liquidityDensity - minValue + range / 8));
    setChartData(newChartData);
  }, [liquidityData, position, currentTick, liquidation]);

  const minTickY = useMemo(() => calculateYPosition(position.lower, chartData), [position, chartData]);

  const maxTickY = useMemo(() => calculateYPosition(position.upper, chartData), [position, chartData]);

  const lowerLiquidationThresholdY = useMemo(
    () => calculateYPosition(liquidation?.lower || 0, chartData),
    [liquidation, chartData]
  );

  const upperLiquidationThresholdY = useMemo(
    () => calculateYPosition(liquidation?.upper || 0, chartData),
    [liquidation, chartData]
  );

  if (chartData == null || chartData.length < 3) return <LiquidityChartPlaceholder />;

  const lowestTick = chartData[0].tick;
  const highestTick = chartData[chartData.length - 1].tick;

  const domain = highestTick - lowestTick;
  const lower = (position.lower - lowestTick) / domain;
  const upper = (position.upper - lowestTick) / domain;
  const current = (currentTick - lowestTick) / domain;

  let positionHighlight: JSX.Element;
  const positionHighlightId = 'positionHighlight'.concat(uniqueId);
  if (currentTick < position.lower) {
    positionHighlight = (
      <linearGradient id={positionHighlightId} x1='0' y1='0' x2='1' y2='0'>
        <stop offset={lower} stopColor='white' stopOpacity={0.0} />
        <stop offset={lower} stopColor={color0} stopOpacity={0.5} />
        <stop offset={upper} stopColor={color0} stopOpacity={0.5} />
        <stop offset={upper} stopColor='white' stopOpacity={0.0} />
      </linearGradient>
    );
  } else if (currentTick < position.upper) {
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
      {chartError && (
        <ChartErrorOverlay>
          <StyledWarningIcon />
          <Text size='M' className='text-center'>
            Liquidity data is currently unavailable. Chart functionality is limited.
          </Text>
        </ChartErrorOverlay>
      )}
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
                  <rect x='0' y='0' width='100%' height='100%' fill={'url(#'.concat(positionHighlightId, ')')} />
                </pattern>
                <pattern id='liqFill' width='100%' height='100%' patternUnits='userSpaceOnUse'>
                  <rect x='0' y='0' width='100%' height='100%' fill='red' mask='url(#stripesMask)' />
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
              {liquidation && (
                <>
                  <ReferenceArea
                    x1={liquidation.upper}
                    x2={887272}
                    strokeWidth='0'
                    fill='url(#liqFill)'
                    ifOverflow='hidden'
                  />
                  <ReferenceArea
                    x1={-887272}
                    x2={liquidation.lower}
                    strokeWidth='0'
                    fill='url(#liqFill)'
                    ifOverflow='hidden'
                  />
                </>
              )}
              {showPOI && (
                <>
                  <ReferenceLine
                    x={position.lower}
                    stroke='transparent'
                    strokeWidth='1'
                    label={({ viewBox }: { viewBox: ViewBox }) => {
                      return MinIconLabel(viewBox.x, minTickY);
                    }}
                  />
                  <ReferenceLine
                    x={position.upper}
                    stroke='transparent'
                    strokeWidth='1'
                    label={({ viewBox }: { viewBox: ViewBox }) => {
                      return MaxIconLabel(viewBox.x, maxTickY);
                    }}
                  />
                  {liquidation && (
                    <>
                      <ReferenceLine
                        x={liquidation.lower}
                        stroke='transparent'
                        strokeWidth='1'
                        label={({ viewBox }: { viewBox: ViewBox }) => {
                          return LiquidationIconLabel(viewBox.x, lowerLiquidationThresholdY);
                        }}
                        isFront={true}
                      />
                      <ReferenceLine
                        x={liquidation.upper}
                        stroke='transparent'
                        strokeWidth='1'
                        label={({ viewBox }: { viewBox: ViewBox }) => {
                          return LiquidationIconLabel(viewBox.x, upperLiquidationThresholdY);
                        }}
                        isFront={true}
                      />
                    </>
                  )}
                </>
              )}
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
