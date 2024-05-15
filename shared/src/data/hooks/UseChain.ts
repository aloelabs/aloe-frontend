import { useMemo } from 'react';
import { useConfig } from 'wagmi';
import { DEFAULT_CHAIN } from '../constants/Values';

export default function useChain() {
  const config = useConfig();

  const chain = useMemo(
    () => config.chains.find((c) => c.id === config.state.chainId) ?? DEFAULT_CHAIN,
    [config.chains, config.state.chainId]
  );

  return chain;
}
