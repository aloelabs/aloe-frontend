import { chain } from 'wagmi';

import { ArbitrumLogo, EthereumLogo, OptimismLogo } from '../../assets/svg/chains';
import { GN } from '../GoodNumber';

export const BRIDGE_SUPPORTED_CHAINS = [chain.mainnet, chain.optimism, chain.arbitrum];

export const SUPPORTED_CHAINS = [chain.goerli, chain.optimism, chain.arbitrum];

export const CHAIN_LOGOS = {
  [chain.mainnet.id]: <EthereumLogo width={16} height={16} />,
  [chain.goerli.id]: <EthereumLogo width={16} height={16} />,
  [chain.optimism.id]: <OptimismLogo width={16} height={16} />,
  [chain.arbitrum.id]: <ArbitrumLogo width={16} height={16} />,
};

export const ANTES = {
  [chain.mainnet.id]: GN.fromDecimalString('0.001', 18),
  [chain.goerli.id]: GN.fromDecimalString('0.001', 18),
  [chain.optimism.id]: GN.fromDecimalString('0.001', 18),
  [chain.arbitrum.id]: GN.fromDecimalString('0.001', 18),
};
