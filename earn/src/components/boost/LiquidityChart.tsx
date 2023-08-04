import { useContext, useEffect, useState } from 'react';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import useEffectOnce from 'shared/lib/data/hooks/UseEffectOnce';
import styled from 'styled-components';
import { useProvider } from 'wagmi';

import { ChainContext } from '../../App';
import { TickData, calculateTickData, fetchUniswapPoolBasics } from '../../data/Uniswap';
import LiquidityChartTooltip from './LiquidityChartTooltip';

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
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  overflow: hidden;
`;

export type LiquidityChartProps = {
  poolAddress: string;
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
};

export default function LiquidityChart(props: LiquidityChartProps) {
  const { poolAddress, currentPrice, minPrice, maxPrice } = props;
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider();
  const [liquidityData, setLiquidityData] = useState<TickData[] | null>(null);
  const [chartData, setChartData] = useState<{ price: number; liquidityDensity: number }[] | null>(null);

  // Fetch (a) uniswapPoolBasics from ethers and (b) liquidityData from TheGraph
  useEffectOnce(() => {
    let mounted = true;
    async function fetch(poolAddress: string) {
      const poolBasics = await fetchUniswapPoolBasics(poolAddress, provider);
      const tickData = await calculateTickData(poolAddress, poolBasics, activeChain.id);
      if (mounted) {
        setLiquidityData(tickData);
      }
    }
    fetch(poolAddress);
    return () => {
      mounted = false;
    };
  });

  // Once liquidityData has been fetched, arrange/format it to be workable chartData
  useEffect(() => {
    if (liquidityData == null) return;

    const liquidityDataCopy = liquidityData.concat();

    const updatedChartData = liquidityDataCopy.map((td: TickData) => {
      return { price: td.price0In1, liquidityDensity: td.totalValueIn0 };
    });
    // TODO: temporary filter while we still use the graph (their data isn't great)
    const filteredChartData = updatedChartData.filter((d) => d.liquidityDensity > 0);
    setChartData(filteredChartData);
  }, [liquidityData, maxPrice, minPrice]);

  if (chartData == null || chartData.length < 3) return null;
  const lowestPrice = chartData[0].price;
  const highestPrice = chartData[chartData.length - 1].price;
  return (
    <Wrapper>
      <ChartWrapper>
        <ResponsiveContainer width='100%' height='100%'>
          <div>
            <AreaChart
              data={chartData}
              width={300}
              height={200}
              margin={{
                top: 0,
                right: 0,
                left: 0,
                bottom: 0,
              }}
            >
              <Area
                type={'monotone'}
                dataKey={'liquidityDensity'}
                data={chartData.filter((d) => d.price >= minPrice && d.price <= currentPrice)}
                stroke={'grey'}
                fill={'grey'}
                fillOpacity={0.5}
                activeDot={false}
              />
              <Area
                type={'monotone'}
                dataKey={'liquidityDensity'}
                data={chartData.filter((d) => d.price >= currentPrice)}
                stroke={'magenta'}
                fill={'magenta'}
                fillOpacity={0.5}
                activeDot={false}
              />
              <Tooltip
                isAnimationActive={false}
                content={(props: any) => {
                  return (
                    <LiquidityChartTooltip
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
