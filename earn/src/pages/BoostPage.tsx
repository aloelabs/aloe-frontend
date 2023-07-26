import { useContext, useEffect, useMemo, useState } from 'react';

import JSBI from 'jsbi';
import { UniswapV3PoolABI } from 'shared/lib/abis/UniswapV3Pool';
import AppPage from 'shared/lib/components/common/AppPage';
import { truncateDecimals } from 'shared/lib/util/Numbers';
import { useAccount, useContractReads, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import {
  UniswapNFTPosition,
  computePoolAddress,
  fetchUniswapNFTPositions,
  getValueOfLiquidity,
  tickToPrice,
} from '../data/Uniswap';

export default function BoostPage() {
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider({ chainId: activeChain.id });
  const { address: userAddress } = useAccount();

  const [uniswapNFTPositions, setUniswapNFTPositions] = useState<Map<number, UniswapNFTPosition>>(new Map());

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (userAddress === undefined) return;
      const fetchedUniswapNFTPositions = await fetchUniswapNFTPositions(userAddress, provider, activeChain);
      if (mounted) {
        setUniswapNFTPositions(fetchedUniswapNFTPositions);
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

      const currentTick = slot0Data[index][1];

      const liquidityAmount = getValueOfLiquidity(
        {
          lower: tickLower,
          upper: tickUpper,
          liquidity: position.liquidity,
        },
        currentTick,
        token1.decimals
      );

      return {
        token0: token0,
        token1: token1,
        minPrice: minPrice,
        maxPrice: maxPrice,
        liquidityAmount: liquidityAmount,
      };
    });
  }, [nonZeroUniswapNFTPositions, slot0Data]);

  return (
    <AppPage>
      <h1>Boost Page</h1>
      {uniswapNFTCardInfo.map((position, index) => {
        const { token0, token1 } = position;

        return (
          <div key={index}>
            <p>
              {token0.symbol} / {token1.symbol}
            </p>
            <p>
              {truncateDecimals(position.liquidityAmount.toString(), 6)} {token1.symbol}
            </p>
            <p>
              {truncateDecimals(position.minPrice.toString(), 3)} {token1.symbol} per {token0.symbol}
            </p>
            <p>
              {truncateDecimals(position.maxPrice.toString(), 3)} {token1.symbol} per {token0.symbol}
            </p>
          </div>
        );
      })}
    </AppPage>
  );
}
