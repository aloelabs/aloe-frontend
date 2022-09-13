import { useState } from 'react';
import { Area, AreaChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import styled from 'styled-components';
import { UniswapPosition } from '../../data/Actions';
import { useDebouncedEffect } from '../../data/hooks/UseDebouncedEffect';
import { getAssets, LiquidationThresholds, MarginAccount, priceToSqrtRatio, sqrtRatioToPrice } from '../../data/MarginAccount';
import { PnLGraphPlaceholder } from './PnLGraphPlaceholder';
import PnLGraphTooltip from './tooltips/PnLGraphTooltip';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const DEBOUNCE_DELAY_MS = 750;

const Wrapper = styled.div`
  position: relative;
  width: 100%;
  height: 300px;
`;

const Container = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
`;

/**
 * 
 * @param value The value to format
 * @returns a string with a number of decimals that is appropriate for the value
 */
export function formatNumberRelativeToSize(value: number): string {
  return Math.abs(value) <  10 ? value.toFixed(6) : value.toFixed(2);
}

function calculatePnL1(
  marginAccount: MarginAccount,
  uniswapPositions: UniswapPosition[],
  price: number,
  initialValue = 0
): number {
  const sqrtPriceX96 = priceToSqrtRatio(price, marginAccount.token0.decimals, marginAccount.token1.decimals);
  const assets = getAssets(marginAccount, uniswapPositions, sqrtPriceX96, sqrtPriceX96, sqrtPriceX96);
  return (
    (assets.fixed0 + assets.fluid0C) * price + assets.fixed1 + assets.fluid1C - (
    (marginAccount.liabilities.amount0 * price) + marginAccount.liabilities.amount1 +
    initialValue
  ));
}

function calculatePnL0(
  marginAccount: MarginAccount,
  uniswapPositions: UniswapPosition[],
  price: number,
  initialValue = 0
): number {
  const invertedPrice = 1 / price;
  const sqrtPriceX96 = priceToSqrtRatio(invertedPrice, marginAccount.token0.decimals, marginAccount.token1.decimals);
  const assets = getAssets(marginAccount, uniswapPositions, sqrtPriceX96, sqrtPriceX96, sqrtPriceX96);
  return (
    (assets.fixed1 + assets.fluid1C) * price + assets.fixed0 + assets.fluid0C - (
    (marginAccount.liabilities.amount1 * price) + marginAccount.liabilities.amount0 +
    initialValue
  ));
}

/**
 * X is price
 * Y is PnL
 */
export type PnLEntry = {
  x: number;
  y: number;
};

export type PnLGraphProps = {
  marginAccount: MarginAccount;
  uniswapPositions: UniswapPosition[];
  inTermsOfToken0: boolean;
  liquidationThresholds: LiquidationThresholds | null;
};

const PLOT_X_SCALE = 1.2;

export default function PnLGraph(props: PnLGraphProps) {
  const { marginAccount, uniswapPositions, inTermsOfToken0, liquidationThresholds } = props;
  const [data, setData] = useState<Array<PnLEntry>>([]);
  const [localInTermsOfToken0, setLocalInTermsOfToken0] = useState<boolean>(inTermsOfToken0);

  let price = sqrtRatioToPrice(marginAccount.sqrtPriceX96, marginAccount.token0.decimals, marginAccount.token1.decimals);
  if (inTermsOfToken0) price = 1 / price;
  const priceA = price / PLOT_X_SCALE;
  const priceB = price * PLOT_X_SCALE;

  const calculatePnL = inTermsOfToken0 ? calculatePnL0 : calculatePnL1;
  const initialValue = calculatePnL(marginAccount, uniswapPositions, price);

  useDebouncedEffect(() => {
    let P = priceA;
    let updatedData = [];
    while (P < priceB) {
      updatedData.push({ x: P, y: calculatePnL(marginAccount, uniswapPositions, P, initialValue) });
      P *= 1.001;
    }
    setData(updatedData);
    setLocalInTermsOfToken0(inTermsOfToken0);
  }, DEBOUNCE_DELAY_MS, [inTermsOfToken0, marginAccount, uniswapPositions]);

  const liquidationLower = liquidationThresholds?.lower ?? 0;
  const liquidationUpper = liquidationThresholds?.upper ?? Infinity;

  const ticks = [price];
  if (liquidationLower > priceA) ticks.push(liquidationLower);
  if (liquidationUpper < priceB) ticks.push(liquidationUpper);

  const gradientOffset = () => {
    const dataMax = Math.max(...data.map((i) => i.y));
    const dataMin = Math.min(...data.map((i) => i.y));

    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;

    return dataMax / (dataMax - dataMin);
  };

  const off = gradientOffset();
  if (data.length === 0 || inTermsOfToken0 !== localInTermsOfToken0) {
    return (
      <PnLGraphPlaceholder />
    );
  }
  return (
    <Wrapper>
      <Container>
        <ResponsiveContainer width='99%' height={300}>
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 0,
              left: 0,
              bottom: 0,
            }}
          >
            <XAxis
              domain={['dataMin', 'dataMax']}
              dataKey='x'
              type='number'
              axisLine={false}
              axisType='xAxis'
              tickLine={false}
              tickCount={5}
              interval={0}
              ticks={ticks}
              tickFormatter={(value: number) => {
                return formatNumberRelativeToSize(value);
              }}
              tick={{ fill: SECONDARY_COLOR, fontSize: '14px' }}
            />
            <YAxis stroke={SECONDARY_COLOR} fontSize='14px' />
            <ReferenceLine y={0} stroke={SECONDARY_COLOR} />
            <ReferenceLine x={price} stroke={SECONDARY_COLOR} strokeWidth={2} />
            <ReferenceLine x={liquidationLower} stroke='rgb(114, 167, 246)' strokeWidth={2} />
            <ReferenceArea x1={data[0].x} x2={liquidationLower} fill='rgba(114, 167, 246, 0.5)' />
            <ReferenceLine x={liquidationUpper} stroke='rgb(114, 167, 246)' strokeWidth={2} />
            <ReferenceArea
              x1={liquidationUpper}
              x2={data[data.length - 1].x}
              fill='rgba(114, 167, 246, 0.5)'
            />
            <Tooltip
              isAnimationActive={false}
              content={(props: any, active = false) => (
                <PnLGraphTooltip
                  token0={marginAccount.token0}
                  token1={marginAccount.token1}
                  inTermsOfToken0={inTermsOfToken0}
                  data={props}
                  active={active}
                />
              )}
            />
            <defs>
              <linearGradient id='splitColor' x1='0' y1='0' x2='0' y2='1'>
                <stop offset={off} stopColor='rgba(128, 196, 128, 0.5)' stopOpacity={1} />
                <stop offset={off} stopColor='rgba(206, 87, 87, 0.5)' stopOpacity={1} />
              </linearGradient>
              <linearGradient id='splitColorFill' x1='0' y1='0' x2='0' y2='1'>
                <stop offset={off} stopColor='rgba(128, 196, 128, 1)' stopOpacity={1} />
                <stop offset={off} stopColor='rgba(206, 87, 87, 1)' stopOpacity={1} />
              </linearGradient>
            </defs>
            <Area
              type='linear'
              dataKey='y'
              stroke='url(#splitColorFill)'
              fill='url(#splitColor)'
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Container>
    </Wrapper>
  );
}
