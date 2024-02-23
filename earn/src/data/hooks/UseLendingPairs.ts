import { createContext, useContext, useMemo } from 'react';

import { Address } from 'wagmi';

import { LendingPair } from '../LendingPair';

export const LendingPairsContext = createContext<LendingPair[] | null>(null);

export function useLendingPairs() {
  const ctxt = useContext(LendingPairsContext);

  return useMemo(
    () => ({
      isLoading: ctxt === null,
      lendingPairs: ctxt ?? [],
    }),
    [ctxt]
  );
}

export function useLendingPair(token0?: Address, token1?: Address) {
  const ctxt = useContext(LendingPairsContext);

  const { lendingPairs } = useMemo(
    () => ({
      isLoading: ctxt === null,
      lendingPairs: ctxt ?? [],
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
