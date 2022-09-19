import {
  WagmiConfig,
  chain,
  createClient,
  configureChains
} from 'wagmi';

import { alchemyProvider } from 'wagmi/providers/alchemy';
import { infuraProvider } from 'wagmi/providers/infura';
import { publicProvider } from 'wagmi/providers/public';

import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';

const { chains, provider, webSocketProvider } = configureChains(
  [chain.mainnet, chain.optimism, chain.arbitrum, chain.goerli],
  [
    alchemyProvider({ apiKey: process.env.REACT_APP_ALCHEMY_API_KEY, priority: 0 }),
    infuraProvider({ apiKey: process.env.REACT_APP_INFURA_ID, priority: 1 }),
    publicProvider({ priority: 2 }),
  ],
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
      options: {
        qrcode: true,
        rpc: { 1: 'TODO' },
      }
    }),
    new CoinbaseWalletConnector({
      chains,
      options: {
        appName: 'Aloe II',
        jsonRpcUrl: 'TODO',
      }
    })
  ],
  provider,
  webSocketProvider,
})

export type WagmiProviderProps = {
  children?: React.ReactNode;
};

export default function WagmiProvider(props: WagmiProviderProps) {
  return (
    <WagmiConfig client={client}>
      {props.children}
    </WagmiConfig>
  );
}
