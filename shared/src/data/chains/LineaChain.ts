import { Chain } from 'wagmi';

export const linea: Chain = {
  id: 59144,
  name: 'Linea',
  network: 'linea',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['https://rpc.linea.build', 'https://linea.drpc.org', 'https://1rpc.io/linea'] },
    default: { http: ['https://rpc.linea.build', 'https://linea.drpc.org', 'https://1rpc.io/linea'] },
  },
  blockExplorers: {
    etherscan: { name: 'LineaScan', url: 'https://lineascan.build/' },
    default: { name: 'LineaScan', url: 'https://lineascan.build/' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 42,
    },
  },
} as const;
