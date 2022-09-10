import React from 'react';
import { Area, AreaChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import styled from 'styled-components';
import { BIGQ96 } from '../../data/constants/Values';
import { Assets, Liabilities, LiquidationThresholds, MarginAccount } from '../../data/MarginAccount';
import PnLGraphTooltip from './tooltips/PnLGraphTooltip';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

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

function calculatePnL0(price: number, assets: Assets, liabilities: Liabilities, initialValue = 0): number {
  const fixedAssets = assets.token0Raw + assets.token0Plus + price * (assets.token1Raw + assets.token1Plus);
  const fluidAssets = 0; // TODO
  const fixedLiabilities = liabilities.amount0 + price * liabilities.amount1;

  return fixedAssets + fluidAssets - fixedLiabilities - initialValue;
}

function calculatePnL1(price: number, assets: Assets, liabilities: Liabilities, initialValue = 0): number {
  const fixedAssets = price * (assets.token0Raw + assets.token0Plus) + assets.token1Raw + assets.token1Plus;
  const fluidAssets = 0; // TODO
  const fixedLiabilities = price * liabilities.amount0 + liabilities.amount1;

  return fixedAssets + fluidAssets - fixedLiabilities - initialValue;
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
  inTermsOfToken0: boolean;
  liquidationThresholds: LiquidationThresholds;
};

const PLOT_X_SCALE = 1.2;

export default function PnLGraph(props: PnLGraphProps) {
  const { marginAccount, inTermsOfToken0 } = props;
  const { token0, token1, sqrtPriceX96, assets, liabilities } = marginAccount;

  let price = sqrtPriceX96
    .mul(sqrtPriceX96)
    .div(BIGQ96)
    .div(BIGQ96)
    .mul(10 ** (token0.decimals - token1.decimals))
    .toNumber();
  if (inTermsOfToken0) price = 1 / price;
  const priceA = price / PLOT_X_SCALE;
  const priceB = price * PLOT_X_SCALE;

  const calculatePnL = inTermsOfToken0 ? calculatePnL0 : calculatePnL1;
  const initialValue = calculatePnL(price, assets, liabilities);

  let P = priceA;
  let data: PnLEntry[] = [];

  while (P < priceB) {
    data.push({ x: P, y: calculatePnL(P, assets, liabilities, initialValue) });
    P *= 1.0001;
  }

  const fakeLowerLiquidationThreshold = data.length > 0 ? data[Math.floor(data.length / 2 - data.length / 5)].x : 0;
  const fakeUpperLiquidationThreshold = Infinity;

  const ticks = [fakeLowerLiquidationThreshold, price];

  const gradientOffset = () => {
    const dataMax = Math.max(...data.map((i) => i.y));
    const dataMin = Math.min(...data.map((i) => i.y));

    if (dataMax <= 0) {
      return 0;
    }
    if (dataMin >= 0) {
      return 1;
    }

    return dataMax / (dataMax - dataMin);
  };

  const off = gradientOffset();
  return (
    <Wrapper>
      <Container>
        <ResponsiveContainer width='99%' height={300}>
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 30,
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
            <ReferenceLine x={fakeLowerLiquidationThreshold} stroke='rgb(114, 167, 246)' strokeWidth={2} />
            <ReferenceArea x1={data[0].x} x2={fakeLowerLiquidationThreshold} fill='rgba(114, 167, 246, 0.5)' />
            <ReferenceLine x={fakeUpperLiquidationThreshold} stroke='rgb(114, 167, 246)' strokeWidth={2} />
            <ReferenceArea
              x1={fakeUpperLiquidationThreshold}
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
