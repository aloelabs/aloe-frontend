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
    return new providers.JsonRpcProvider((transport.transports as ReturnType<Transport>[])[0].value?.url, network);
  return new providers.JsonRpcProvider(transport.url, network);
}

export function useEthersProvider(client?: Client<Transport, Chain>) {
  const [provider, setProvider] = useState<ethers.providers.JsonRpcProvider | undefined>(undefined);

  useEffect(() => {
    if (!client || client.chain.id === provider?.network.chainId) return;

    const newProvider = clientToProvider(client);
    // No reason to set state and re-render everything if chainId still doesn't match
    if (newProvider.network.chainId !== client.chain.id) return;

    try {
      setProvider(newProvider);
    } catch (e) {
      console.error(e);
    }
  }, [client, provider]);

  return provider;
}
