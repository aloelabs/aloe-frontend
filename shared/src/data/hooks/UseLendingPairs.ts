import { createContext, useContext, useMemo } from 'react';

import { Address } from 'viem';

import { LendingPair } from '../LendingPair';

export const LendingPairsContext = createContext<{
  lendingPairs: LendingPair[] | null;
  refetch?: () => void;
  chainId: number;
}>({
  lendingPairs: null,
  chainId: -1,
});

export function useLendingPairs(chainId: number) {
  const ctxt = useContext(LendingPairsContext);

  return useMemo(
    () => ({
      isLoading: ctxt.lendingPairs === null,
      lendingPairs: ctxt.chainId === chainId && ctxt.lendingPairs !== null ? ctxt.lendingPairs : [],
      refetch: ctxt.refetch,
    }),
    [ctxt, chainId]
  );
}

export function useLendingPair(token0?: Address, token1?: Address) {
  const ctxt = useContext(LendingPairsContext);

  const { lendingPairs } = useMemo(
    () => ({
      isLoading: ctxt.lendingPairs === null,
      lendingPairs: ctxt.lendingPairs ?? [],
    }),
    [ctxt]
  );

  return useMemo(
    () =>
      lendingPairs.find(
        (pair) =>
          pair.token0.address.toLowerCase() === token0?.toLowerCase() &&
          pair.token1.address.toLowerCase() === token1?.toLowerCase()
      ),
    [lendingPairs, token0, token1]
  );
}
