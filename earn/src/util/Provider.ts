import { useEffect, useState } from 'react';

import { ethers, providers } from 'ethers';
import type { Chain, Client, Transport } from 'viem';

export function clientToProvider(client: Client<Transport, Chain>) {
  const { chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  if (transport.type === 'fallback')
    return new providers.FallbackProvider(
      (transport.transports as ReturnType<Transport>[]).map(
        ({ value }) => new providers.JsonRpcProvider(value?.url, network)
      )
    );
  return new providers.JsonRpcProvider(transport.url, network);
}

export function useEthersProvider(client?: Client<Transport, Chain>) {
  const [provider, setProvider] = useState<
    ethers.providers.JsonRpcProvider | ethers.providers.FallbackProvider | undefined
  >(undefined);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!client || provider !== undefined) return;
      const newProvider = clientToProvider(client);
      const readyNetwork = await newProvider.ready;
      if (mounted && client?.chain.id === readyNetwork.chainId) setProvider(newProvider);
    })();

    return () => {
      mounted = false;
    };
  }, [client, provider]);

  return provider;
}
