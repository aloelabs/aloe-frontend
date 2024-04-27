import { Chain } from 'wagmi';

export const base: Chain = {
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    ankr: { http: ['https://rpc.ankr.com/base'] },
    public: { http: ['https://mainnet.base.org'] },
    default: { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    etherscan: { name: 'BaseScan', url: 'https://basescan.org' },
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 5022,
    },
  },
} as const;
