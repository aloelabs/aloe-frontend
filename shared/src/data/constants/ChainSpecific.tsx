import { arbitrum, optimism, mainnet, goerli } from 'wagmi/chains';
import { base } from '../BaseChain';
import { Address } from 'wagmi';

import { ArbitrumLogo, BaseLogo, EthereumLogo, OptimismLogo } from '../../assets/svg/chains';
import { GN } from '../GoodNumber';

export const BRIDGE_SUPPORTED_CHAINS = [mainnet, optimism, arbitrum];

export const SUPPORTED_CHAINS = [mainnet, optimism, arbitrum, base];

export const ALL_CHAINS = [mainnet, optimism, arbitrum, base];

export const CHAIN_LOGOS: { [chainId: number]: JSX.Element } = {
  [mainnet.id]: <EthereumLogo width={16} height={16} />,
  [goerli.id]: <EthereumLogo width={16} height={16} />,
  [optimism.id]: <OptimismLogo width={16} height={16} />,
  [arbitrum.id]: <ArbitrumLogo width={16} height={16} />,
  [base.id]: <BaseLogo width={16} height={16} />,
};

export const ANTES: { [chainId: number]: GN } = {
  [mainnet.id]: GN.fromDecimalString('0.001', 18),
  [goerli.id]: GN.fromDecimalString('0.001', 18),
  [optimism.id]: GN.fromDecimalString('0.001', 18),
  [arbitrum.id]: GN.fromDecimalString('0.001', 18),
  [base.id]: GN.fromDecimalString('0.001', 18),
};

export const MULTICALL_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xcA11bde05977b3631167028862bE2a173976CA11',
  [optimism.id]: '0xcA11bde05977b3631167028862bE2a173976CA11',
  [arbitrum.id]: '0xcA11bde05977b3631167028862bE2a173976CA11',
  [base.id]: '0xcA11bde05977b3631167028862bE2a173976CA11',
};

export const UNISWAP_FACTORY_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  [optimism.id]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  [arbitrum.id]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  [base.id]: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
};

export const UNISWAP_PERMIT2_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  [optimism.id]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  [arbitrum.id]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  [base.id]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
};

export const UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  [optimism.id]: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  [arbitrum.id]: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  [base.id]: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
};

export const ALOE_II_FACTORY_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x000000009efdB26b970bCc0085E126C9dfc16ee8',
  [optimism.id]: '0x000000009efdB26b970bCc0085E126C9dfc16ee8',
  [arbitrum.id]: '0x000000009efdB26b970bCc0085E126C9dfc16ee8',
  [base.id]: '0x000000009efdB26b970bCc0085E126C9dfc16ee8',
};

export const ALOE_II_BORROWER_LENS_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x46AeD741F9a329c0721519D6E66fA47Bb17B0986',
  [optimism.id]: '0x46AeD741F9a329c0721519D6E66fA47Bb17B0986',
  [arbitrum.id]: '0x46AeD741F9a329c0721519D6E66fA47Bb17B0986',
  [base.id]: '0x46AeD741F9a329c0721519D6E66fA47Bb17B0986',
};

export const ALOE_II_LENDER_LENS_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x2a1591e54315766e943382beF5E5C8e55c1b9C6C',
  [optimism.id]: '0x2a1591e54315766e943382beF5E5C8e55c1b9C6C',
  [arbitrum.id]: '0x2a1591e54315766e943382beF5E5C8e55c1b9C6C',
  [base.id]: '0x2a1591e54315766e943382beF5E5C8e55c1b9C6C',
};

export const ALOE_II_ROUTER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x00000000380f13622e73eA495F25F8F7F2da7dC2',
  [optimism.id]: '0x00000000380f13622e73eA495F25F8F7F2da7dC2',
  [arbitrum.id]: '0x00000000380f13622e73eA495F25F8F7F2da7dC2',
  [base.id]: '0x00000000380f13622e73eA495F25F8F7F2da7dC2',
};

export const ALOE_II_SIMPLE_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xBb5A35B80b15A8E5933fDC11646A20f6159Dd061',
  [optimism.id]: '0xBb5A35B80b15A8E5933fDC11646A20f6159Dd061',
  [arbitrum.id]: '0xBb5A35B80b15A8E5933fDC11646A20f6159Dd061',
  [base.id]: '0xBb5A35B80b15A8E5933fDC11646A20f6159Dd061',
};

export const ALOE_II_BORROWER_NFT_MULTI_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x2b7E3A41Eac757CC1e8e9E61a4Ad5C9D6421516e',
  [optimism.id]: '0x2b7E3A41Eac757CC1e8e9E61a4Ad5C9D6421516e',
  [arbitrum.id]: '0x2b7E3A41Eac757CC1e8e9E61a4Ad5C9D6421516e',
  [base.id]: '0x2b7E3A41Eac757CC1e8e9E61a4Ad5C9D6421516e',
};

export const ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xA07FD687882FfE7380A044e7542bDAc6F8672Bf7',
  [optimism.id]: '0xA07FD687882FfE7380A044e7542bDAc6F8672Bf7',
  [arbitrum.id]: '0xA07FD687882FfE7380A044e7542bDAc6F8672Bf7',
  [base.id]: '0xA07FD687882FfE7380A044e7542bDAc6F8672Bf7',
};

export const ALOE_II_ORACLE_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x0000000030d51e39a2dDDb5Db50F9d74a289DFc3',
  [optimism.id]: '0x0000000030d51e39a2dDDb5Db50F9d74a289DFc3',
  [arbitrum.id]: '0x0000000030d51e39a2dDDb5Db50F9d74a289DFc3',
  [base.id]: '0x0000000030d51e39a2dDDb5Db50F9d74a289DFc3',
};

export const ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x99E6e3C307FB8391E77215e47f3d8A3E38478CC3',
  [optimism.id]: '0x99E6e3C307FB8391E77215e47f3d8A3E38478CC3',
  [arbitrum.id]: '0x99E6e3C307FB8391E77215e47f3d8A3E38478CC3',
  [base.id]: '0x03a3f925Ccb761e5fE1e684a20a553BFe3D9B6e5',
};

export const ALOE_II_FRONTEND_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x3Bb9F64b0e6b15dD5792A008c06E5c4Dc9d23D8f',
  [optimism.id]: '0x3Bb9F64b0e6b15dD5792A008c06E5c4Dc9d23D8f',
  [arbitrum.id]: '0x3Bb9F64b0e6b15dD5792A008c06E5c4Dc9d23D8f',
  [base.id]: '0x3Bb9F64b0e6b15dD5792A008c06E5c4Dc9d23D8f',
};

export const ALOE_II_BORROWER_NFT_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x00000000000078b629B7C06f5339060648468AA6',
  [optimism.id]: '0x00000000000078b629B7C06f5339060648468AA6',
  [arbitrum.id]: '0x00000000000078b629B7C06f5339060648468AA6',
  [base.id]: '0x00000000000078b629B7C06f5339060648468AA6',
};

export const ALOE_II_BOOST_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xB6B7521cd3bd116432FeD94c2262Dd02BA616Db4',
  [optimism.id]: '0xB6B7521cd3bd116432FeD94c2262Dd02BA616Db4',
  [arbitrum.id]: '0xB6B7521cd3bd116432FeD94c2262Dd02BA616Db4',
  [base.id]: '0x8E287b280671700EBE66A908A56C648f930b73b4',
};

export const ALOE_II_PERMIT2_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x6BDa468b1d473028938585a04eC3c62dcFF5309B',
  [optimism.id]: '0x6BDa468b1d473028938585a04eC3c62dcFF5309B',
  [arbitrum.id]: '0x6BDa468b1d473028938585a04eC3c62dcFF5309B',
  [base.id]: '0x6BDa468b1d473028938585a04eC3c62dcFF5309B',
};
