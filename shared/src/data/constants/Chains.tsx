import { chain } from 'wagmi';

import { ArbitrumLogo, EthereumLogo, OptimismLogo } from '../../assets/svg/chains';

export const SUPPORTED_CHAINS = [chain.goerli, chain.optimism, chain.arbitrum];

export const CHAIN_LOGOS = {
  [chain.mainnet.id]: <EthereumLogo width={16} height={16} />,
  [chain.goerli.id]: <EthereumLogo width={16} height={16} />,
  [chain.optimism.id]: <OptimismLogo width={16} height={16} />,
  [chain.arbitrum.id]: <ArbitrumLogo width={16} height={16} />,
};
