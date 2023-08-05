import { useContext, useEffect, useMemo, useState } from 'react';

import JSBI from 'jsbi';
import { UniswapV3PoolABI } from 'shared/lib/abis/UniswapV3Pool';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { toBig } from 'shared/lib/util/Numbers';
import { useAccount, useContractReads, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import BoostCard from '../components/boost/BoostCard';
import { BoostCardPlaceholder } from '../components/boost/BoostCardPlaceholder';
import { sqrtRatioToPrice } from '../data/BalanceSheet';
import {
  UniswapNFTPosition,
  UniswapPosition,
  computePoolAddress,
  fetchUniswapNFTPositions,
  getAmountsForLiquidity,
  tickToPrice,
} from '../data/Uniswap';
import { getProminentColor } from '../util/Colors';

export default function BoostPage() {
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider({ chainId: activeChain.id });
  const { address: userAddress } = useAccount();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [uniswapNFTPositions, setUniswapNFTPositions] = useState<Map<number, UniswapNFTPosition>>(new Map());
  const [colors, setColors] = useState<Map<number, [string, string]>>(new Map());

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (userAddress === undefined) return;
      const fetchedUniswapNFTPositions = await fetchUniswapNFTPositions(userAddress, provider, activeChain);
      if (mounted) {
        setUniswapNFTPositions(fetchedUniswapNFTPositions);
        setIsLoading(false);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [activeChain, provider, userAddress]);

  const nonZeroUniswapNFTPositions = useMemo(() => {
    return Array.from(uniswapNFTPositions.values()).filter((position) => {
      return JSBI.greaterThan(position.liquidity, JSBI.BigInt(0));
    });
  }, [uniswapNFTPositions]);

  useEffect(() => {
    const fetch = async () => {
      const entries = Array.from(nonZeroUniswapNFTPositions.entries()).map(async ([idx, pos]) => {
        const color0 = (await getProminentColor(pos.token0.logoURI)).replace(' ', '');
        const color1 = (await getProminentColor(pos.token1.logoURI)).replace(' ', '');
        return [idx, [`rgb(${color0})`, `rgb(${color1})`]] as [number, [string, string]];
      });

      setColors(new Map(await Promise.all(entries)));
    };

    fetch();
    return () => {};
  }, [nonZeroUniswapNFTPositions]);

  const contracts = useMemo(() => {
    return nonZeroUniswapNFTPositions.map((position) => {
      return {
        abi: UniswapV3PoolABI,
        address: computePoolAddress(position),
        functionName: 'slot0',
        chainId: activeChain.id,
      } as const;
    });
  }, [activeChain.id, nonZeroUniswapNFTPositions]);

  const { data: slot0Data } = useContractReads({
    contracts: contracts,
    allowFailure: false,
  });

  const uniswapNFTCardInfo = useMemo(() => {
    if (slot0Data === undefined || slot0Data.length !== nonZeroUniswapNFTPositions.length) {
      return [];
    }
    return nonZeroUniswapNFTPositions.map((position, index) => {
      const { token0, token1, tickLower, tickUpper } = position;

      const minPrice = tickToPrice(tickLower, token0.decimals, token1.decimals, true);
      const maxPrice = tickToPrice(tickUpper, token0.decimals, token1.decimals, true);

      const sqrtPriceX96 = slot0Data[index][0];
      const currentTick = slot0Data[index][1];

      const uniswapPosition: UniswapPosition = {
        lower: tickLower,
        upper: tickUpper,
        liquidity: position.liquidity,
      };

      const [amount0, amount1] = getAmountsForLiquidity(uniswapPosition, currentTick, token0.decimals, token1.decimals);

      const token0PerToken1 = sqrtRatioToPrice(toBig(sqrtPriceX96), token0.decimals, token1.decimals);
      const amount0InTermsOfToken1 = amount0 * token0PerToken1;
      const totalValue = amount0InTermsOfToken1 + amount1;

      const amount0Percent = totalValue > 0 ? (amount0InTermsOfToken1 / totalValue) * 100 : 0;
      const amount1Percent = totalValue > 0 ? (amount1 / totalValue) * 100 : 0;

      const isInRange = uniswapPosition && currentTick >= uniswapPosition.lower && currentTick <= uniswapPosition.upper;

      const isDeposit = Math.random() > 0.5; // TODO: figure out how to determine if this is a deposit or withdrawal

      const poolAddress = computePoolAddress(position);
      const currentPrice = sqrtRatioToPrice(toBig(sqrtPriceX96), token0.decimals, token1.decimals);

      return {
        token0: token0,
        token1: token1,
        minPrice: minPrice,
        maxPrice: maxPrice,
        amount0: amount0,
        amount1: amount1,
        amount0Percent: amount0Percent,
        amount1Percent: amount1Percent,
        isInRange: isInRange,
        isDeposit: isDeposit,
        poolAddress: poolAddress,
        currentPrice: currentPrice,
        tickLower,
        tickUpper,
        currentTick,
      };
    });
  }, [nonZeroUniswapNFTPositions, slot0Data]);

  return (
    <AppPage>
      <Text size='XL'>Boost</Text>
      <div className='flex flex-wrap gap-4 mt-4'>
        {isLoading &&
          uniswapNFTCardInfo.length === 0 &&
          [...Array(4)].map((_, index) => <BoostCardPlaceholder key={index} />)}
        {uniswapNFTCardInfo.map((position, index) => {
          return (
            <BoostCard
              key={index}
              token0={position.token0}
              token1={position.token1}
              minPrice={position.minPrice}
              maxPrice={position.maxPrice}
              minTick={position.tickLower}
              maxTick={position.tickUpper}
              currentTick={position.currentTick}
              amount0={position.amount0}
              amount1={position.amount1}
              amount0Percent={position.amount0Percent}
              amount1Percent={position.amount1Percent}
              isInRange={position.isInRange}
              isDeposit={position.isDeposit}
              poolAddress={position.poolAddress}
              color0={colors.get(index)?.[0] ?? 'red'}
              color1={colors.get(index)?.[1] ?? 'blue'}
              uniqueId={index.toString()}
            />
          );
        })}
      </div>
    </AppPage>
  );
}
