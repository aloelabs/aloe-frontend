import React from 'react';
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styled from 'styled-components';
import { BIGQ96 } from '../../data/constants/Values';
import { Assets, Liabilities, MarginAccount } from '../../data/MarginAccount';

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

function calculatePnL0(price: number, assets: Assets, liabilities: Liabilities, initialValue = 0): number {
  const fixedAssets = assets.token0Raw + assets.token0Plus + price * (assets.token1Raw + assets.token1Plus);
  const fluidAssets = 0; // TODO
  const fixedLiabilities = liabilities.amount0 + price * liabilities.amount1;

  return (fixedAssets + fluidAssets - fixedLiabilities) - initialValue;
}

function calculatePnL1(price: number, assets: Assets, liabilities: Liabilities, initialValue = 0): number {
  const fixedAssets = price * (assets.token0Raw + assets.token0Plus) + assets.token1Raw + assets.token1Plus;
  const fluidAssets = 0; // TODO
  const fixedLiabilities = price * liabilities.amount0 + liabilities.amount1;

  return (fixedAssets + fluidAssets - fixedLiabilities) - initialValue;
}

/**
 * X is price
 * Y is PnL
 */
export type PnLEntry = {
  x: number;
  y: number;
}

export type PnLGraphProps = {
  marginAccount: MarginAccount,
  inTermsOfToken0: boolean,
};

const PLOT_X_SCALE = 1.2;

export default function PnLGraph(props: PnLGraphProps) {
  const { marginAccount, inTermsOfToken0 } = props;
  const { token0, token1, sqrtPriceX96, assets, liabilities } = marginAccount;

  let price = sqrtPriceX96.mul(sqrtPriceX96).div(BIGQ96).div(BIGQ96).mul(10 ** (token0.decimals - token1.decimals)).toNumber();
  if (inTermsOfToken0) price = 1 / price;
  const priceA = price / PLOT_X_SCALE;
  const priceB = price * PLOT_X_SCALE;

  const calculatePnL = (inTermsOfToken0 ? calculatePnL0 : calculatePnL1);
  const initialValue = calculatePnL(price, assets, liabilities);

  let P = priceA;
  let data: PnLEntry[] = [];

  while (P < priceB) {
    data.push({ x: P, y: calculatePnL(P, assets, liabilities, initialValue) });
    P *= 1.0001;
  }

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
              domain={['auto', 'auto']}
              interval={0}
              dataKey='x'
              axisLine={false}
              tickLine={false}
              hide={true}
            />
            <YAxis stroke={SECONDARY_COLOR}  />
            <ReferenceLine
              y={0}
              stroke={SECONDARY_COLOR}
            />
            <Tooltip
              isAnimationActive={false}
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
