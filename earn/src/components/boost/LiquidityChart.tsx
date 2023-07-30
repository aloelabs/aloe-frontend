import { XAxis, ResponsiveContainer, ReferenceLine, AreaChart, Area, Tooltip } from 'recharts';
import styled from 'styled-components';

import LiquidityTooltip from './LiquidityTooltip';

export type ChartEntry = {
  price: number;
  liquidityDensity: number;
};

const Wrapper = styled.div`
  position: relative;
  width: 100%;
  height: 200px;
  margin-bottom: -20px;
`;

const ChartWrapper = styled.div`
  position: absolute;
  width: 300px;
  height: 200px;
  top: 0;
  left: -16px;
`;

export type LiquidityChartProps = {
  data: ChartEntry[];
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
};

export default function LiquidityChart(props: LiquidityChartProps) {
  const { data, currentPrice, minPrice, maxPrice } = props;
  const lowestPrice = data[0]?.price;
  const highestPrice = data[data.length - 1]?.price || 0;
  return (
    <Wrapper>
      <ChartWrapper>
        <ResponsiveContainer width='100%' height='100%'>
          <div>
            <AreaChart
              data={data}
              width={300}
              height={200}
              margin={{
                top: 0,
                right: 0,
                left: 0,
                bottom: 0,
              }}
            >
              {minPrice >= lowestPrice && <ReferenceLine x={minPrice} stroke='yellow' strokeWidth={2} isFront={true} />}
              {maxPrice <= highestPrice && (
                <ReferenceLine x={maxPrice} stroke='yellow' strokeWidth={2} isFront={true} />
              )}
              <Area
                type={'monotone'}
                dataKey={'liquidityDensity'}
                data={data.filter((d) => d.price >= minPrice && d.price <= currentPrice)}
                stroke={'grey'}
                fill={'grey'}
                activeDot={false}
              />
              <Area
                type={'monotone'}
                dataKey={'liquidityDensity'}
                data={data.filter((d) => d.price >= currentPrice)}
                stroke={'magenta'}
                fill={'magenta'}
                activeDot={false}
              />
              <Tooltip
                isAnimationActive={false}
                content={(props: any) => {
                  return (
                    <LiquidityTooltip
                      active={props?.active ?? false}
                      selectedPrice={props?.payload[0]?.payload.price}
                      currentPrice={currentPrice}
                      x={props?.coordinate?.x ?? 0}
                    />
                  );
                }}
              />
              <XAxis dataKey='price' type='number' domain={[lowestPrice, highestPrice]} tick={false} height={0} />
            </AreaChart>
          </div>
        </ResponsiveContainer>
      </ChartWrapper>
    </Wrapper>
  );
}
