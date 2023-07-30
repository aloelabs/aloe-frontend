import { useContext, useEffect, useState } from 'react';

import useEffectOnce from 'shared/lib/data/hooks/UseEffectOnce';
import { useProvider } from 'wagmi';

import { ChainContext } from '../../App';
import { TickData, UniswapV3PoolBasics, calculateTickData, fetchUniswapPoolBasics } from '../../data/Uniswap';
import LiquidityChart from './LiquidityChart';

export type BoostGraphProps = {
  poolAddress: string;
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
};

export default function BoostGraph(props: BoostGraphProps) {
  const { poolAddress, currentPrice, minPrice, maxPrice } = props;
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider();
  const [uniswapPoolBasics, setUniswapPoolBasics] = useState<UniswapV3PoolBasics | null>(null);
  const [liquidityData, setLiquidityData] = useState<TickData[] | null>(null);
  const [chartData, setChartData] = useState<{ price: number; liquidityDensity: number }[] | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  // Fetch (a) uniswapPoolBasics from ethers and (b) liquidityData from TheGraph
  useEffectOnce(() => {
    let mounted = true;
    async function fetch(poolAddress: string) {
      const poolBasics = await fetchUniswapPoolBasics(poolAddress, provider);
      if (mounted) {
        setUniswapPoolBasics(poolBasics);
      }
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
    const filteredChartData = updatedChartData.filter(
      (d) => d.liquidityDensity > 0 && d.price > minPrice - 200 && d.price < maxPrice + 300
    );
    setChartData(filteredChartData);
    setChartLoading(false);
  }, [liquidityData, maxPrice, minPrice]);

  if (chartData == null || chartData.length < 3) return null;
  return <LiquidityChart data={chartData} currentPrice={currentPrice} minPrice={minPrice} maxPrice={maxPrice} />;
}
