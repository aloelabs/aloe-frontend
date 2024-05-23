import { useEffect, useState } from 'react';
import { LendingPair } from '../data/LendingPair';
import { Token } from '../data/Token';
import { GetNumericFeeTier } from '../data/FeeTier';
import { Address } from 'viem';

type UniswapPoolsMap = Map<Address, { token0: Token; token1: Token; fee: number }>;

/**
 * Isolates Uniswap pool changes from other `lendingPairs` changes to prevent unnecessary renders/fetches.
 * @param lendingPairs Unordered list of lending pairs expected to change frequently due to oracle & balance data.
 * @returns Map of Uniswap pool data that only changes when switching chains or deploying new markets.
 */
export function useUniswapPools(lendingPairs: LendingPair[]) {
  const [uniswapPools, setUniswapPools] = useState<UniswapPoolsMap>(new Map());

  useEffect(() => {
    const newUniswapPools: UniswapPoolsMap = new Map();
    let shouldUpdate = lendingPairs.length < uniswapPools.size;

    lendingPairs.forEach((pair) => {
      const { token0, token1 } = pair;
      if (token0.chainId !== token1.chainId) {
        throw new Error(`Token chainIds mismatched in a LendingPair (Uniswap: ${pair.uniswapPool})`);
      }

      newUniswapPools.set(pair.uniswapPool, { token0, token1, fee: GetNumericFeeTier(pair.uniswapFeeTier) });
      // If the old map (a) doesn't include the pool OR (b) it includes it, but on the wrong chain, do an update
      if (
        !uniswapPools.has(pair.uniswapPool) ||
        token0.chainId !== uniswapPools.get(pair.uniswapPool)!.token0.chainId
      ) {
        shouldUpdate = true;
      }
    });

    if (shouldUpdate) setUniswapPools(newUniswapPools);
  }, [lendingPairs, uniswapPools]);

  return uniswapPools;
}
