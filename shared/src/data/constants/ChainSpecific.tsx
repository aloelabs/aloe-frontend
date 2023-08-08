import { arbitrum, optimism, mainnet, goerli } from 'wagmi/chains';
import { base } from '../BaseChain';
import { Address } from 'wagmi';

import { ArbitrumLogo, EthereumLogo, OptimismLogo } from '../../assets/svg/chains';
import { GN } from '../GoodNumber';
import {
  ALOE_II_BORROWER_LENS_ADDRESS_ARBITRUM,
  ALOE_II_BORROWER_LENS_ADDRESS_BASE,
  ALOE_II_BORROWER_LENS_ADDRESS_OPTIMISM,
  ALOE_II_FACTORY_ADDRESS_ARBITRUM,
  ALOE_II_FACTORY_ADDRESS_BASE,
  ALOE_II_FACTORY_ADDRESS_OPTIMISM,
  ALOE_II_LENDER_LENS_ADDRESS_ARBITRUM,
  ALOE_II_LENDER_LENS_ADDRESS_BASE,
  ALOE_II_LENDER_LENS_ADDRESS_OPTIMISM,
  ALOE_II_ORACLE_ADDRESS_ARBITRUM,
  ALOE_II_ORACLE_ADDRESS_BASE,
  ALOE_II_ORACLE_ADDRESS_OPTIMISM,
  ALOE_II_ROUTER_ADDRESS_ARBITRUM,
  ALOE_II_ROUTER_ADDRESS_BASE,
  ALOE_II_ROUTER_ADDRESS_OPTIMISM,
  ALOE_II_SIMPLE_MANAGER_ADDRESS_ARBITRUM,
  ALOE_II_SIMPLE_MANAGER_ADDRESS_BASE,
  ALOE_II_SIMPLE_MANAGER_ADDRESS_OPTIMISM,
  ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS_ARBITRUM,
  ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS_BASE,
  ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS_OPTIMISM,
  ALOE_II_WITHDRAW_MANAGER_ADDRESS_ARBITRUM,
  ALOE_II_WITHDRAW_MANAGER_ADDRESS_BASE,
  ALOE_II_WITHDRAW_MANAGER_ADDRESS_OPTIMISM,
  UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS_ARBITRUM,
  UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS_BASE,
  UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS_OPTIMISM,
  UNISWAP_PERMIT2_ADDRESS_ARBITRUM,
  UNISWAP_PERMIT2_ADDRESS_BASE,
  UNISWAP_PERMIT2_ADDRESS_OPTIMISM,
} from './Addresses';

export const BRIDGE_SUPPORTED_CHAINS = [mainnet, optimism, arbitrum];

export const SUPPORTED_CHAINS = [goerli, optimism, arbitrum, base];

export const ALL_CHAINS = [mainnet, goerli, optimism, arbitrum, base];

export const CHAIN_LOGOS: { [chainId: number]: JSX.Element } = {
  [mainnet.id]: <EthereumLogo width={16} height={16} />,
  [goerli.id]: <EthereumLogo width={16} height={16} />,
  [optimism.id]: <OptimismLogo width={16} height={16} />,
  [arbitrum.id]: <ArbitrumLogo width={16} height={16} />,
  [base.id]: <EthereumLogo width={16} height={16} />,
};

export const ANTES: { [chainId: number]: GN } = {
  [mainnet.id]: GN.fromDecimalString('0.001', 18),
  [goerli.id]: GN.fromDecimalString('0.001', 18),
  [optimism.id]: GN.fromDecimalString('0.001', 18),
  [arbitrum.id]: GN.fromDecimalString('0.001', 18),
  [base.id]: GN.fromDecimalString('0.001', 18),
};

export const UNISWAP_PERMIT2_ADDRESS: { [chainId: number]: Address } = {
  [optimism.id]: UNISWAP_PERMIT2_ADDRESS_OPTIMISM,
  [arbitrum.id]: UNISWAP_PERMIT2_ADDRESS_ARBITRUM,
  [base.id]: UNISWAP_PERMIT2_ADDRESS_BASE,
};

export const UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [optimism.id]: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS_OPTIMISM,
  [arbitrum.id]: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS_ARBITRUM,
  [base.id]: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS_BASE,
};

export const ALOE_II_FACTORY_ADDRESS: { [chainId: number]: Address } = {
  [optimism.id]: ALOE_II_FACTORY_ADDRESS_OPTIMISM,
  [arbitrum.id]: ALOE_II_FACTORY_ADDRESS_ARBITRUM,
  [base.id]: ALOE_II_FACTORY_ADDRESS_BASE,
};

export const ALOE_II_BORROWER_LENS_ADDRESS: { [chainId: number]: Address } = {
  [optimism.id]: ALOE_II_BORROWER_LENS_ADDRESS_OPTIMISM,
  [arbitrum.id]: ALOE_II_BORROWER_LENS_ADDRESS_ARBITRUM,
  [base.id]: ALOE_II_BORROWER_LENS_ADDRESS_BASE,
};

export const ALOE_II_LENDER_LENS_ADDRESS: { [chainId: number]: Address } = {
  [optimism.id]: ALOE_II_LENDER_LENS_ADDRESS_OPTIMISM,
  [arbitrum.id]: ALOE_II_LENDER_LENS_ADDRESS_ARBITRUM,
  [base.id]: ALOE_II_LENDER_LENS_ADDRESS_BASE,
};

export const ALOE_II_ROUTER_ADDRESS: { [chainId: number]: Address } = {
  [optimism.id]: ALOE_II_ROUTER_ADDRESS_OPTIMISM,
  [arbitrum.id]: ALOE_II_ROUTER_ADDRESS_ARBITRUM,
  [base.id]: ALOE_II_ROUTER_ADDRESS_BASE,
};

export const ALOE_II_SIMPLE_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [optimism.id]: ALOE_II_SIMPLE_MANAGER_ADDRESS_OPTIMISM,
  [arbitrum.id]: ALOE_II_SIMPLE_MANAGER_ADDRESS_ARBITRUM,
  [base.id]: ALOE_II_SIMPLE_MANAGER_ADDRESS_BASE,
};

export const ALOE_II_ORACLE_ADDRESS: { [chainId: number]: Address } = {
  [optimism.id]: ALOE_II_ORACLE_ADDRESS_OPTIMISM,
  [arbitrum.id]: ALOE_II_ORACLE_ADDRESS_ARBITRUM,
  [base.id]: ALOE_II_ORACLE_ADDRESS_BASE,
};

export const ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [optimism.id]: ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS_OPTIMISM,
  [arbitrum.id]: ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS_ARBITRUM,
  [base.id]: ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS_BASE,
};

export const ALOE_II_WITHDRAW_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [optimism.id]: ALOE_II_WITHDRAW_MANAGER_ADDRESS_OPTIMISM,
  [arbitrum.id]: ALOE_II_WITHDRAW_MANAGER_ADDRESS_ARBITRUM,
  [base.id]: ALOE_II_WITHDRAW_MANAGER_ADDRESS_BASE,
};
