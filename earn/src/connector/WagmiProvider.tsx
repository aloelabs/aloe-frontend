import { WagmiConfig, chain, createClient, configureChains } from 'wagmi';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { infuraProvider } from 'wagmi/providers/infura';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { publicProvider } from 'wagmi/providers/public';

let providers = [
  jsonRpcProvider({
    // ankr
    rpc(targetChain) {
      if (targetChain === chain.mainnet) return { http: 'https://rpc.ankr.com/eth' };
      if (targetChain === chain.optimism) return { http: 'https://rpc.ankr.com/optimism' };
      if (targetChain === chain.arbitrum) return { http: 'https://rpc.ankr.com/arbitrum' };
      return null;
    },
    priority: 2,
  }),
  jsonRpcProvider({
    // blast
    rpc(targetChain) {
      if (targetChain === chain.mainnet) return { http: 'https://eth-mainnet.public.blastapi.io' };
      if (targetChain === chain.optimism) return { http: 'https://optimism-mainnet.public.blastapi.io' };
      if (targetChain === chain.arbitrum) return { http: 'https://arbitrum-one.public.blastapi.io' };
      return null;
    },
    priority: 3,
  }),
  publicProvider({ priority: 4 }),
];

if (process.env.REACT_APP_ALCHEMY_API_KEY) {
  providers.push(
    alchemyProvider({
      apiKey: process.env.REACT_APP_ALCHEMY_API_KEY || '',
      priority: 0,
    })
  );
}
if (process.env.REACT_APP_INFURA_ID) {
  providers.push(infuraProvider({ apiKey: process.env.REACT_APP_INFURA_ID || '', priority: 1 }));
}

const { chains, provider, webSocketProvider } = configureChains(
  [chain.mainnet, chain.optimism, chain.arbitrum, chain.goerli],
  providers,
  { stallTimeout: 5000 }
);

const client = createClient({
  autoConnect: true,
  connectors: [
    new InjectedConnector({
      chains,
      options: { shimDisconnect: true },
    }),
    new WalletConnectConnector({
      chains,
      options: { qrcode: true },
    }),
    new CoinbaseWalletConnector({
      chains,
      options: { appName: 'Aloe II' },
    }),
  ],
  provider,
  webSocketProvider,
});

export type WagmiProviderProps = {
  children?: React.ReactNode;
};

export default function WagmiProvider(props: WagmiProviderProps) {
  return <WagmiConfig client={client}>{props.children}</WagmiConfig>;
}
