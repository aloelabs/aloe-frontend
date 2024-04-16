import { ethers } from 'ethers';
import { WagmiConfig, createClient, configureChains, Connector } from 'wagmi';
import { arbitrum, optimism, mainnet } from 'wagmi/chains';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { publicProvider } from 'wagmi/providers/public';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';

import { DEFAULT_CHAIN } from '../data/constants/Values';
import { ALL_CHAINS } from '../data/constants/ChainSpecific';
import { base } from '../data/BaseChain';

function fallbackProvider({ chainId }: { chainId?: number }) {
  const targetChain = ALL_CHAINS.find((v) => v.id === chainId) || DEFAULT_CHAIN;
  const config = {
    chainId: targetChain.id,
    name: targetChain.name,
  };

  const providers: ethers.providers.FallbackProviderConfig[] = [];
  if (window.ethereum !== undefined) {
    providers.push({
      provider: new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider, config),
      priority: 0,
      stallTimeout: 5000,
    });
  }

  switch (config.chainId) {
    case mainnet.id:
      providers.push({
        provider: new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/eth', config),
        priority: 1,
      });
      providers.push({
        provider: new ethers.providers.JsonRpcProvider('https://eth-mainnet.public.blastapi.io', config),
        priority: 1,
      });
      break;
    case optimism.id:
      providers.push({
        provider: new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/optimism', config),
        priority: 1,
      });
      providers.push({
        provider: new ethers.providers.JsonRpcProvider('https://optimism-mainnet.public.blastapi.io', config),
        priority: 1,
      });
      break;
    case arbitrum.id:
      providers.push({
        provider: new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/arbitrum', config),
        priority: 1,
      });
      providers.push({
        provider: new ethers.providers.JsonRpcProvider('https://arbitrum-one.public.blastapi.io', config),
        priority: 1,
      });
      break;
    case base.id:
      providers.push({
        provider: new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/base', config),
        priority: 1,
      });
      break;
    default:
      throw new Error('Unsupported network');
  }

  return new ethers.providers.FallbackProvider(providers, 1);
}

const providers = [publicProvider({ priority: 2 })];
if (process.env.REACT_APP_ALCHEMY_API_KEY) {
  providers.push(alchemyProvider({ apiKey: process.env.REACT_APP_ALCHEMY_API_KEY, priority: 0 }));
  // Since ethers/wagmi don't support base chain yet, we need to add it manually
  providers.push(
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id !== base.id) return null;
        return {
          http: `https://base-mainnet.g.alchemy.com/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`,
          ws: `wss://base-mainnet.ws.alchemyapi.io/v2/${process.env.REACT_APP_ALCHEMY_API_KEY}`,
        };
      },
      priority: 0,
    })
  );
}
if (process.env.REACT_APP_ANKR_API_KEY) {
  providers.push(
    jsonRpcProvider({
      rpc: (chain) => ({
        http: `https://rpc.ankr.com/${chain.network}/${process.env.REACT_APP_ANKR_API_KEY}`,
        ws: `wss://rpc.ankr.com/${chain.network}/ws/${process.env.REACT_APP_ANKR_API_KEY}`,
      }),
      priority: 1,
    })
  );
}
const hasNonPublicRpc = providers.length > 1;

// @ts-ignore
const { chains, provider, webSocketProvider } = configureChains(ALL_CHAINS, providers, {
  stallTimeout: 5000,
});

const connectors: Connector[] = [
  new InjectedConnector({
    chains,
    options: { shimDisconnect: false },
  }),
  new CoinbaseWalletConnector({
    chains,
    options: { appName: 'Aloe II' },
  }),
];

if (process.env.REACT_APP_WALLET_CONNECT_PROJECT_ID) {
  connectors.push(
    new WalletConnectConnector({
      chains,
      options: { projectId: process.env.REACT_APP_WALLET_CONNECT_PROJECT_ID },
    })
  );
}

const client = createClient({
  autoConnect: true,
  connectors,
  // @ts-ignore
  provider: hasNonPublicRpc ? provider : fallbackProvider,
  webSocketProvider: hasNonPublicRpc ? webSocketProvider : undefined,
});

export type WagmiProviderProps = {
  children?: React.ReactNode;
};

export default function WagmiProvider(props: WagmiProviderProps) {
  return <WagmiConfig client={client}>{props.children}</WagmiConfig>;
}
