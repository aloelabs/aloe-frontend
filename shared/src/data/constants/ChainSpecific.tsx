import { arbitrum, optimism, mainnet, goerli } from 'wagmi/chains';

import { ArbitrumLogo, EthereumLogo, OptimismLogo } from '../../assets/svg/chains';
import { GN } from '../GoodNumber';

export const BRIDGE_SUPPORTED_CHAINS = [mainnet, optimism, arbitrum];

export const SUPPORTED_CHAINS = [goerli, optimism, arbitrum];

export const ALL_CHAINS = [mainnet, goerli, optimism, arbitrum];

export const CHAIN_LOGOS: { [chainId: number]: JSX.Element } = {
  [mainnet.id]: <EthereumLogo width={16} height={16} />,
  [goerli.id]: <EthereumLogo width={16} height={16} />,
  [optimism.id]: <OptimismLogo width={16} height={16} />,
  [arbitrum.id]: <ArbitrumLogo width={16} height={16} />,
};

export const ANTES: { [chainId: number]: GN } = {
  [mainnet.id]: GN.fromDecimalString('0.001', 18),
  [goerli.id]: GN.fromDecimalString('0.001', 18),
  [optimism.id]: GN.fromDecimalString('0.001', 18),
  [arbitrum.id]: GN.fromDecimalString('0.001', 18),
};
