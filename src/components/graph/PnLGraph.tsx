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
import { MarginAccount } from '../../data/MarginAccount';

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

function calculatePnL(price: number): number {
  return 0;
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
};

export default function PnLGraph(props: PnLGraphProps) {
  const { marginAccount } = props;
  const sqrtPriceX96 = marginAccount.sqrtPriceX96;
  const data = [
    {
      x: 1,
      y: -50,
    },
    {
      x: 2,
      y: 0,
    },
    {
      x: 3,
      y: 50,
    },
    {
      x: 4,
      y: 50,
    },
  ];

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
            {/* <Tooltip
              isAnimationActive={false}
            /> */}
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
