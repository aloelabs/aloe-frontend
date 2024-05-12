import { createConfig, fallback, http } from 'wagmi';
import { arbitrum, optimism, mainnet, base, linea, scroll } from 'viem/chains';

import { coinbaseWallet, injected, safe, walletConnect } from 'wagmi/connectors';

import { ALL_CHAINS } from '../data/constants/ChainSpecific';
import { Transport } from 'viem';

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
// Public endpoints
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

export const wagmiConfig = createConfig({
  chains: ALL_CHAINS,
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId: process.env.REACT_APP_WALLET_CONNECT_PROJECT_ID!,
      qrModalOptions: {
        themeMode: 'dark',
        termsOfServiceUrl: 'https://aloe.capital/legal/terms-of-service',
        // TODO: many more options available here
      },
      showQrModal: true,
    }),
    coinbaseWallet({
      appName: 'Aloe',
      // TODO: many more options available here
    }),
    safe(),
  ],
  batch: {
    multicall: {},
    // TODO: many more options available here
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

// TODO: seems like it could be useful, but breaks things rn
// declare module 'wagmi' {
//   interface Register {
//     config: typeof wagmiConfig
//   }
// }
