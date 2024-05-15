import { ReactNode } from 'react';
import { WagmiProvider, createConfig, fallback, http } from 'wagmi';
import { arbitrum, optimism, mainnet, base, linea, scroll } from 'viem/chains';

import { coinbaseWallet, injected, safe, walletConnect } from 'wagmi/connectors';

import { ALL_CHAINS } from '../data/constants/ChainSpecific';
import { Transport } from 'viem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const transports: { [chainId: number]: Transport[] } = Object.fromEntries(ALL_CHAINS.map((c) => [c.id, []]));

// Alchemy endpoints
if (process.env.REACT_APP_ALCHEMY_API_KEY) {
  transports[mainnet.id].push(http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`));
  transports[optimism.id].push(http(`https://opt-mainnet.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`));
  transports[arbitrum.id].push(http(`https://arb-mainnet.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`));
  transports[base.id].push(http(`https://base-mainnet.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`));
}
// Infura endpoints
if (process.env.REACT_APP_INFURA_API_KEY) {
  transports[linea.id].push(http(`https://linea-mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_API_KEY}`));
}
// TODO: Wallet-provided endpoints
// ALL_CHAINS.forEach((c) => transports[c.id].push(unstable_connector(injected, { retryCount: 1 })));
// Public endpoint alternatives
transports[mainnet.id].push(http('https://eth-mainnet.public.blastapi.io'));
transports[optimism.id].push(http('https://optimism-mainnet.public.blastapi.io'));
transports[arbitrum.id].push(http('https://arbitrum-one.public.blastapi.io'));
transports[linea.id].push(
  http('https://rpc.linea.build'),
  http('https://linea.decubate.com'),
  http('https://linea.blockpi.network/v1/rpc/public')
);
transports[scroll.id].push(
  http('https://scroll.drpc.org'),
  http('https://rpc.scroll.io'),
  http('https://1rpc.io/scroll')
);

const projectId = process.env.REACT_APP_WALLET_CONNECT_PROJECT_ID!;
const metadata = {
  name: 'Aloe',
  description: 'Permissionless lending built on Uniswap',
  url: 'https://aloe.capital',
  icons: ['https://avatars.githubusercontent.com/u/82793388'],
};

const config = createConfig({
  chains: ALL_CHAINS,
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({ projectId, metadata, showQrModal: false }),
    coinbaseWallet({
      appName: metadata.name,
      // appLogoUrl: // TODO: do better than favicon
      // appChainIds: [mainnet.id, optimism.id, arbitrum.id, base.id],
      darkMode: true,
    }),
    safe(),
  ],
  batch: {
    multicall: {
      batchSize: 2048,
      wait: 100,
    },
  },
  cacheTime: 4000,
  pollingInterval: 4000,
  transports: {
    [mainnet.id]: fallback(transports[mainnet.id], { rank: false }),
    [optimism.id]: fallback(transports[optimism.id], { rank: false }),
    [arbitrum.id]: fallback(transports[arbitrum.id], { rank: false }),
    [base.id]: fallback(transports[base.id], { rank: false }),
    [linea.id]: fallback(transports[linea.id], { rank: false }),
    [scroll.id]: fallback(transports[scroll.id], { rank: false }),
  },
});

const queryClient = new QueryClient();

export const Web3Provider = ({ children }: { children: ReactNode }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
};

// TODO: seems like it could be useful, but breaks things rn
// declare module 'wagmi' {
//   interface Register {
//     config: typeof wagmiConfig
//   }
// }
