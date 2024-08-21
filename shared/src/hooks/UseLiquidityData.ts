import { useQuery } from '@tanstack/react-query';
import { Chain } from 'viem';
import { TickData, UniswapPosition, calculateTickData } from '../data/Uniswap';
import * as Sentry from '@sentry/react';
import { Token } from '../data/Token';

export type LeaderboardEnsEntry = {
  name: string | null;
  lastChecked: number;
};

export type LeaderboardResponseEntry = {
  address: string;
  score: string;
  ens?: LeaderboardEnsEntry;
};

export function useLiquidityData(
  poolAddress: string,
  position: UniswapPosition,
  currentTick: number,
  token0: Token,
  token1: Token,
  activeChain: Chain,
  refetchInterval = 10 * 60 * 1_000
) {
  const queryFn = async () => {
    let tickData: TickData[];
    try {
      tickData = await calculateTickData(poolAddress, activeChain.id);
    } catch (e) {
      Sentry.captureException(e, {
        extra: {
          poolAddress,
          chain: {
            id: activeChain.id,
            name: activeChain.name,
          },
          assets: {
            asset0: {
              symbol: token0.symbol,
              address: token0.address,
            },
            asset1: {
              symbol: token1.symbol,
              address: token1.address,
            },
          },
        },
      });
      const cutoffLeft = Math.min(position.lower, currentTick);
      const cutoffRight = Math.max(position.upper, currentTick);
      tickData = [
        {
          tick: cutoffLeft,
          liquidityDensity: 0,
        },
        {
          tick: currentTick,
          liquidityDensity: 0,
        },
        {
          tick: cutoffRight,
          liquidityDensity: 0,
        },
      ];
      return tickData;
    }
    return tickData;
  };

  const queryKey = ['useLiquidityData'];

  return useQuery({
    queryKey,
    queryFn,
    staleTime: refetchInterval,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval,
    refetchIntervalInBackground: false,
    placeholderData: [],
  });
}
