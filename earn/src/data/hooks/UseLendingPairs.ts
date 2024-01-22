import { createContext, useContext, useMemo } from 'react';

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
