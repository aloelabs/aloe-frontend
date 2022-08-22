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

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

export default function PnLGraph() {
  const data = [
    {
      amount: -50,
      pv: 2400,
      amt: 2400,
    },
    {
      amount: 0,
      pv: 1398,
      amt: 2210,
    },
    {
      amount: 50,
      pv: 9800,
      amt: 2290,
    },
    {
      amount: 50,
      pv: 3908,
      amt: 2000,
    },
  ];

  const gradientOffset = () => {
    const dataMax = Math.max(...data.map((i) => i.amount));
    const dataMin = Math.min(...data.map((i) => i.amount));

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
    <ResponsiveContainer width='100%' height='100%'>
      <AreaChart
        width={500}
        height={400}
        data={data}
        margin={{
          top: 10,
          right: 30,
          left: 0,
          bottom: 0,
        }}
      >
        <XAxis dataKey='name' axisLine={false} tickLine={false} />
        <YAxis stroke={SECONDARY_COLOR} />
        <ReferenceLine y={0} stroke={SECONDARY_COLOR} />
        <Tooltip />
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
        <Area type='linear' dataKey='amount' stroke='url(#splitColorFill)' fill='url(#splitColor)' />
      </AreaChart>
    </ResponsiveContainer>
  );
}
