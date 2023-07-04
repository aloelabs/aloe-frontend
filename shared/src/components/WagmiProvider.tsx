import { ethers } from 'ethers';
import { WagmiConfig, createClient, configureChains } from 'wagmi';
import { arbitrum, optimism, mainnet } from 'wagmi/chains';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { infuraProvider } from 'wagmi/providers/infura';
import { publicProvider } from 'wagmi/providers/public';

import { DEFAULT_CHAIN } from '../data/constants/Values';
import { ALL_CHAINS } from '../data/constants/ChainSpecific';

function fallbackProvider({ chainId }: { chainId?: number }) {
  const targetChain = ALL_CHAINS.find((v) => v.id === chainId) || DEFAULT_CHAIN;
  const config = {
    // ensAddress: targetChain.ens?.address,
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
    default:
      throw new Error('Unsupported network');
  }

  return new ethers.providers.FallbackProvider(providers, 1);
}

const providers = [publicProvider({ priority: 2 })];
if (process.env.REACT_APP_ALCHEMY_API_KEY) {
  providers.push(alchemyProvider({ apiKey: process.env.REACT_APP_ALCHEMY_API_KEY || '', priority: 0 }));
}
if (process.env.REACT_APP_INFURA_ID) {
  providers.push(infuraProvider({ apiKey: process.env.REACT_APP_INFURA_ID || '', priority: 1 }));
}
const hasNonPublicRpc = providers.length > 1;

// @ts-ignore
const { chains, provider, webSocketProvider } = configureChains(ALL_CHAINS, providers, {
  stallTimeout: 5000,
});

const client = createClient({
  autoConnect: true,
  connectors: [
    new InjectedConnector({
      chains,
      options: { shimDisconnect: true },
    }),
    new WalletConnectConnector({
      chains,
      options: { projectId: '3475bfb3ffc4cd0576fabe5d47efeafb' },
    }),
    new CoinbaseWalletConnector({
      chains,
      options: { appName: 'Aloe II' },
    }),
  ],
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
