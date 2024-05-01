import { Chain } from 'wagmi';

export const scroll: Chain = {
  id: 534352,
  name: 'Scroll',
  network: 'scroll',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: {
      http: [
        'https://rpc.scroll.io',
        'https://scroll-mainnet.public.blastapi.io',
        'https://1rpc.io/scroll',
        'https://scroll.drpc.org',
      ],
    },
    default: {
      http: [
        'https://rpc.scroll.io',
        'https://scroll-mainnet.public.blastapi.io',
        'https://1rpc.io/scroll',
        'https://scroll.drpc.org',
      ],
    },
  },
  blockExplorers: {
    etherscan: { name: 'ScrollScan', url: 'https://scrollscan.com/' },
    default: { name: 'ScrollScan', url: 'https://scrollscan.com/' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 14,
    },
  },
} as const;
