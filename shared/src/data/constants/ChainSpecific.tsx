import { arbitrum, optimism, mainnet, goerli } from 'wagmi/chains';
import { base } from '../BaseChain';
import { Address } from 'wagmi';

import { ArbitrumLogo, BaseLogo, EthereumLogo, OptimismLogo } from '../../assets/svg/chains';

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

export function getChainLogo(chainId: number, size: number): JSX.Element {
  switch (chainId) {
    case mainnet.id:
      return <EthereumLogo width={size} height={size} />;
    case goerli.id:
      return <EthereumLogo width={size} height={size} />;
    case optimism.id:
      return <OptimismLogo width={size} height={size} />;
    case arbitrum.id:
      return <ArbitrumLogo width={size} height={size} />;
    case base.id:
      return <BaseLogo width={size} height={size} />;
    default:
      return <EthereumLogo width={size} height={size} />;
  }
}

export const APPROX_SECONDS_PER_BLOCK: { [chainId: number]: number } = {
  [mainnet.id]: 12.07,
  [optimism.id]: 2,
  [arbitrum.id]: 0.25,
  [base.id]: 2,
};

export const MANAGER_NAME_MAP: { [manager: Address]: string } = {
  '0xBb5A35B80b15A8E5933fDC11646A20f6159Dd061': 'SimpleManager',
  '0x2b7E3A41Eac757CC1e8e9E61a4Ad5C9D6421516e': 'BorrowerNFTMultiManager',
  '0xA07FD687882FfE7380A044e7542bDAc6F8672Bf7': 'BorrowerNFTSimpleManager',
  '0xe1Bf15D99330E684020622856916F854c9322CB6': 'BorrowerNFTWithdrawManager',
  '0x3EE236D69F6950525ff317D7a872439F09902C65': 'UniswapNFTManager',
  '0x7357E37a60839DE89A52861Cf50851E317FFBE71': 'UniswapNFTManager',
  '0x3Bb9F64b0e6b15dD5792A008c06E5c4Dc9d23D8f': 'FrontendManager',
  '0xB6B7521cd3bd116432FeD94c2262Dd02BA616Db4': 'BoostManager',
  '0x8E287b280671700EBE66A908A56C648f930b73b4': 'BoostManager',
  '0x6BDa468b1d473028938585a04eC3c62dcFF5309B': 'Permit2Manager',
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
  [mainnet.id]: '0x267Fa142FA270F39738443b914FB7d3F95462451',
  [optimism.id]: '0x267Fa142FA270F39738443b914FB7d3F95462451',
  [arbitrum.id]: '0x267Fa142FA270F39738443b914FB7d3F95462451',
  [base.id]: '0x267Fa142FA270F39738443b914FB7d3F95462451',
};

export const ALOE_II_LENDER_LENS_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x1f36838Ac6e3922dD26f1222d75af86185f2b798',
  [optimism.id]: '0x1f36838Ac6e3922dD26f1222d75af86185f2b798',
  [arbitrum.id]: '0x1f36838Ac6e3922dD26f1222d75af86185f2b798',
  [base.id]: '0x1f36838Ac6e3922dD26f1222d75af86185f2b798',
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

export const ALOE_II_BORROWER_NFT_WITHDRAW_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xe1Bf15D99330E684020622856916F854c9322CB6',
  [optimism.id]: '0xe1Bf15D99330E684020622856916F854c9322CB6',
  [arbitrum.id]: '0xe1Bf15D99330E684020622856916F854c9322CB6',
  [base.id]: '0xe1Bf15D99330E684020622856916F854c9322CB6',
};

export const ALOE_II_ORACLE_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x0000000030d51e39a2dDDb5Db50F9d74a289DFc3',
  [optimism.id]: '0x0000000030d51e39a2dDDb5Db50F9d74a289DFc3',
  [arbitrum.id]: '0x0000000030d51e39a2dDDb5Db50F9d74a289DFc3',
  [base.id]: '0x0000000030d51e39a2dDDb5Db50F9d74a289DFc3',
};

export const ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x3EE236D69F6950525ff317D7a872439F09902C65',
  [optimism.id]: '0x3EE236D69F6950525ff317D7a872439F09902C65',
  [arbitrum.id]: '0x3EE236D69F6950525ff317D7a872439F09902C65',
  [base.id]: '0x7357E37a60839DE89A52861Cf50851E317FFBE71',
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
