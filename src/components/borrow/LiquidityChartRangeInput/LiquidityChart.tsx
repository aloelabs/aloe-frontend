import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import styled from 'styled-components';
import { TickData } from '../actions/UniswapAddLiquidityActionCard';

export type ChartEntry = {
  index: number;
  isCurrent: boolean;
  activeLiquidity: number;
  price0: number;
  price1: number;
};

const Wrapper = styled.div`
  position: relative;
  width: 100%;
  height: 250px;
`;

type StyledBarProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};

function StyledBar(props: StyledBarProps) {
  const { x, y, width, height, fill } = props;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} />
    </g>
  );
}

export type LiquidityChartProps = {
  data: TickData[];
  rangeStart: number;
  rangeEnd: number;
};

export default function LiquidityChart(props: LiquidityChartProps) {
  const { data, rangeStart, rangeEnd } = props;
  const ticks = [
    data[Math.floor(Math.floor(data.length / 2) / 2)].price1In0,
    data[Math.floor(data.length / 2)].price1In0,
    data[
      Math.floor(data.length / 2) + Math.floor(Math.floor(data.length / 2) / 2)
    ].price1In0,
  ];
  return (
    <Wrapper>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart
          width={300}
          height={200}
          data={data}
          barGap={0}
          barCategoryGap={0}
        >
          <Bar
            dataKey='totalValueIn0'
            fill='rgb(38, 176, 130)'
            isAnimationActive={false}
            shape={(props) => {
              const fill = props.isCurrent ? 'white' : props.fill;
              return (
                <StyledBar
                  x={props.x}
                  y={props.y}
                  width={props.width}
                  height={props.height}
                  fill={fill}
                />
              );
            }}
          />
          <ReferenceLine
            className='relative'
            x={data[rangeStart].price1In0}
            stroke='rgb(114, 167, 246)'
            strokeWidth={4}
            isFront={true}
          />
          <ReferenceArea
            x1={data[rangeStart].price1In0}
            x2={data[rangeEnd].price1In0}
            fill='rgba(114, 167, 246, 0.5)'
          />
          <ReferenceLine
            x={data[rangeEnd].price1In0}
            stroke='rgb(114, 167, 246)'
            strokeWidth={4}
            isFront={true}
          />
          <XAxis
            dataKey='price1In0'
            tickCount={3}
            ticks={ticks}
            tick={(props) => {
              return (
                <g>
                  <text
                    x={props.x}
                    y={props.y + 5}
                    fill='rgb(130, 160, 182)'
                    fontFamily='Satoshi-Variable'
                    textAnchor='middle'
                    dominantBaseline='central'
                  >
                    {props.payload.value.toFixed(0)}
                  </text>
                </g>
              );
            }}
            tickFormatter={(value) => {
              console.log(value);
              return value.toFixed(0);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </Wrapper>
  );
}
