import { BarChart, Bar, XAxis, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import styled from 'styled-components';

export type ChartEntry = {
  price: number;
  liquidityDensity: number;
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

function nearestPriceInGraphOrNull(
  price: number,
  minPrice: number,
  maxPrice: number,
  data: ChartEntry[],
): number | null {
  if (price < minPrice || price > maxPrice) return null;
  return data.reduce((prev: ChartEntry, curr: ChartEntry) => {
    let prevDiff = Math.abs(price - prev.price);
    let currDiff = Math.abs(price - curr.price);
    return prevDiff < currDiff ? prev : curr;
  }).price;
}

export type LiquidityChartProps = {
  data: ChartEntry[];
  rangeStart: string;
  rangeEnd: string;
  currentPrice: string;
};

export default function LiquidityChart(props: LiquidityChartProps) {
  const { data, rangeStart, rangeEnd, currentPrice } = props;
  const minPrice = data.length > 0 ? data[0].price : 0;
  const maxPrice = data.length > 0 ? data[data.length - 1].price : 0;
  const updatedRangeStart = nearestPriceInGraphOrNull(parseFloat(rangeStart), minPrice, maxPrice, data);
  const updatedRangeEnd = nearestPriceInGraphOrNull(parseFloat(rangeEnd), minPrice, maxPrice, data);
  const updatedCurrentPrice = nearestPriceInGraphOrNull(parseFloat(currentPrice), minPrice, maxPrice, data);
  const ticks = [
    data[Math.floor(Math.floor(data.length / 2) / 2)].price,
    data[Math.floor(data.length / 2)].price,
    data[Math.floor(data.length / 2) + Math.floor(Math.floor(data.length / 2) / 2)].price,
  ];
  return (
    <Wrapper>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart width={300} height={200} data={data} barGap={0} barCategoryGap={0}>
          <Bar
            dataKey='liquidityDensity'
            fill='rgb(38, 176, 130)'
            isAnimationActive={false}
            shape={(props) => {
              return <StyledBar x={props.x} y={props.y} width={props.width} height={props.height} fill={props.fill} />;
            }}
          />
          {updatedRangeStart && (
            <ReferenceLine x={updatedRangeStart} stroke='rgb(114, 167, 246)' strokeWidth={4} isFront={true} />
          )}
          <ReferenceArea
            x1={updatedRangeStart || minPrice}
            x2={updatedRangeEnd || maxPrice}
            fill='rgba(114, 167, 246, 0.5)'
          />
          {updatedRangeEnd && (
            <ReferenceLine x={updatedRangeEnd} stroke='rgb(114, 167, 246)' strokeWidth={4} isFront={true} />
          )}
          {updatedCurrentPrice && (
            <ReferenceLine x={updatedCurrentPrice} stroke='rgba(255, 255, 255, 0.5)' strokeWidth={2} isFront={false} />
          )}
          <XAxis
            dataKey='price'
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
                    {props.payload.value.toFixed(4)}
                  </text>
                </g>
              );
            }}
            tickFormatter={(value) => {
              return value.toFixed(4);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </Wrapper>
  );
}
