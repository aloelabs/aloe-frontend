import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
} from 'recharts';
import styled from 'styled-components';
import { Text } from '../../common/Typography';
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

const CustomBar = ({
  x,
  y,
  width,
  height,
  fill,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}) => {
  return (
    <g>
      <rect x={x} y={y} fill={fill} width={width} height={height} />
    </g>
  );
};

const CustomRange = ({
  x,
  y,
  width,
  height,
  fill,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}) => {
  return (
    <g>
      <rect
        x={x - (width * 6) / 2}
        y={0}
        fill='#72a7f6'
        width={width * 6}
        height='calc(100% - 35px)'
      />
      <rect x={x} y={y} fill={fill} width={width} height={height} />
    </g>
  );
};

const CustomInsideRange = ({
  x,
  y,
  width,
  height,
  fill,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}) => {
  return (
    <g>
      <rect
        x={x}
        y={0}
        fill='rgba(114, 167, 246, 0.2)'
        width={width}
        height='calc(100% - 35px)'
      />
      <rect x={x} y={y} fill={fill} width={width} height={height} />
    </g>
  );
};

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
    data[Math.floor(data.length / 2) + Math.floor(Math.floor(data.length / 2) / 2)].price1In0,
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
            dataKey='amount1'
            fill='rgb(38, 176, 130)'
            isAnimationActive={false}
            shape={(props) => {
              const fill = props.isCurrent ? 'white' : props.fill;
              if (rangeStart === props.index || rangeEnd === props.index) {
                return (
                  <CustomRange
                    width={props.width}
                    height={props.height}
                    x={props.x}
                    y={props.y}
                    fill={fill}
                  />
                );
              } else if (rangeStart < props.index && rangeEnd > props.index) {
                return (
                  <CustomInsideRange
                    width={props.width}
                    height={props.height}
                    x={props.x}
                    y={props.y}
                    fill={fill}
                  />
                );
              }
              return (
                <CustomBar
                  width={props.width}
                  height={props.height}
                  x={props.x}
                  y={props.y}
                  fill={fill}
                />
              );
            }}
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
              )
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
