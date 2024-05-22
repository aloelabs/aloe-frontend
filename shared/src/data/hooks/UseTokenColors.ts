import { useEffect, useState } from 'react';
import { LendingPair } from '../LendingPair';
import { Address } from 'viem';
import { getProminentColor } from '../../util/Colors';
import { useQuery } from '@tanstack/react-query';

export function useTokenColors(lendingPairs: LendingPair[]) {
  const [tokens, setTokens] = useState(new Map<Address, string>());

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
