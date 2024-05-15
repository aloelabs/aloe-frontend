import React from 'react';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CurveType } from 'recharts/types/shape/Curve';

export type GraphChart = {
  uniqueId: string;
  type: CurveType;
  dataKey: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  activeDot?: JSX.Element;
};

export type GraphProps = {
  data: any;
  charts: GraphChart[];
  linearGradients?: React.SVGProps<SVGLinearGradientElement>[];
  CustomTooltip?: JSX.Element;
  tooltipPosition?: { x: number | undefined; y: number | undefined };
  tooltipOffset?: number;
  tooltipCursor?: React.SVGProps<SVGElement>;
  size?: { width: number | '100%'; height: number };
  aspectRatio?: number;
};

export default function LineGraph(props: GraphProps) {
  const { data, charts, linearGradients, CustomTooltip, tooltipPosition, tooltipOffset, tooltipCursor } = props;

  const responsiveContainerProps = props.aspectRatio ? { aspect: props.aspectRatio } : props.size;

  return (
    <ResponsiveContainer {...responsiveContainerProps}>
      <LineChart
        data={data}
        margin={{
          top: 0,
          left: -1,
          bottom: -2,
          right: -2,
        }}
        // @ts-ignore
        baseValue={'dataMin'}
      >
        <defs>
          {linearGradients &&
            linearGradients.map((gradient, index) => (
              <React.Fragment key={index}>{React.isValidElement(gradient) ? gradient : null}</React.Fragment>
            ))}
        </defs>
        <XAxis
          hide={true}
          dataKey='x'
          type='number'
          domain={['dataMin', 'dataMax']}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          hide={true}
          width={0}
          height={0}
          orientation='right'
          type='number'
          domain={['dataMin - 2', 'dataMax + 2']}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={CustomTooltip}
          allowEscapeViewBox={{ x: false, y: false }}
          position={tooltipPosition}
          offset={tooltipOffset}
          cursor={tooltipCursor}
          wrapperStyle={{ outline: 'none' }}
          isAnimationActive={false}
        />
        {charts.map((chart, index) => (
          <Line
            key={index}
            id={chart.uniqueId}
            type={chart.type}
            dataKey={chart.dataKey}
            legendType='none'
            dot={false}
            activeDot={chart.activeDot}
            stroke={chart.stroke}
            strokeWidth={chart.strokeWidth}
            strokeDasharray={chart.strokeDasharray}
            connectNulls={true}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
