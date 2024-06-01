import { useEffect, useState } from 'react';
import { LendingPair } from '../data/LendingPair';
import { Address } from 'viem';
import { getProminentColor } from '../util/Colors';
import { useQuery } from '@tanstack/react-query';

/**
 * Fetches all pertinent token colors for the lending pairs. Token colors are persisted in cache for efficiency.
 * @param lendingPairs Unordered list of lending pairs expected to change frequently due to oracle & balance data.
 * @returns Map from token address to colors of the form `${r}, ${g}, ${b}`
 */
export function useTokenColors(lendingPairs: LendingPair[]) {
  const [tokens, setTokens] = useState(new Map<Address, string>());

  // Isolate token changes from other `lendingPairs` changes to prevent unnecessary renders/fetches.
  // We can't rely on Tanstack to do this for us, since the `tokens` are part of the `queryKey`,
  // not just part of the query.
  useEffect(() => {
    const newTokens = new Map<Address, string>();
    let shouldUpdate = false;

    lendingPairs.forEach((pair) => {
      const { token0, token1 } = pair;

      newTokens.set(token0.address, token0.logoURI);
      newTokens.set(token1.address, token1.logoURI);

      // If the old map (a) doesn't include the tokens OR (b) includes them, but with the wrong URI, do an update
      if (token0.logoURI !== tokens.get(token0.address) || token1.logoURI !== tokens.get(token1.address)) {
        shouldUpdate = true;
      }
    });

    if (shouldUpdate) setTokens(newTokens);
  }, [lendingPairs, tokens]);

  const queryFn = async () => {
    const colors = await Promise.all(
      Array.from(tokens.entries()).map(async ([k, v]) => [k, await getProminentColor(v || '')] as [Address, string])
    );
    const addressToColorMap = new Map<Address, string>(colors);
    return addressToColorMap;
  };

  // NOTE: Important for `queryKey` to consist of arrays/objects, NOT a `Map` (hence the conversion)
  const queryKey = ['useTokenColors', Object.fromEntries(tokens.entries())];

  return useQuery({
    queryKey,
    queryFn,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: new Map<Address, string>(),
  });
}
