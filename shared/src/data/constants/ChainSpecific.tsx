import { arbitrum, optimism, mainnet, base, linea, scroll } from 'viem/chains';

import { ArbitrumLogo, BaseLogo, EthereumLogo, LineaLogo, OptimismLogo, ScrollLogo } from '../../assets/svg/chains';
import { GN } from '../GoodNumber';
import { Address } from 'viem';

export const BRIDGE_SUPPORTED_CHAINS = [mainnet, optimism, arbitrum];

export const SUPPORTED_CHAINS = [mainnet, optimism, arbitrum, base, linea];

export const ALL_CHAINS = [mainnet, optimism, arbitrum, base, linea, scroll] as const;

export const CHAIN_NAMES: { [chainId: number]: string } = {
  [mainnet.id]: 'ethereum',
  [optimism.id]: 'optimism',
  [arbitrum.id]: 'arbitrum',
  [base.id]: 'base',
  [linea.id]: 'linea',
  [scroll.id]: 'scroll',
};

export const CHAIN_LOGOS: { [chainId: number]: JSX.Element } = {
  [mainnet.id]: <EthereumLogo width={16} height={16} />,
  [optimism.id]: <OptimismLogo width={16} height={16} />,
  [arbitrum.id]: <ArbitrumLogo width={16} height={16} />,
  [base.id]: <BaseLogo width={16} height={16} />,
  [linea.id]: <LineaLogo width={16} height={16} />,
  [scroll.id]: <ScrollLogo width={16} height={16} />,
};

export function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId];
}

export function getChainLogo(chainId: number, size: number): JSX.Element {
  switch (chainId) {
    case mainnet.id:
      return <EthereumLogo width={size} height={size} />;
    case optimism.id:
      return <OptimismLogo width={size} height={size} />;
    case arbitrum.id:
      return <ArbitrumLogo width={size} height={size} />;
    case base.id:
      return <BaseLogo width={size} height={size} />;
    case linea.id:
      return <LineaLogo width={size} height={size} />;
    case scroll.id:
      return <ScrollLogo width={size} height={size} />;
    default:
      return <EthereumLogo width={size} height={size} />;
  }
}

export const APPROX_SECONDS_PER_BLOCK: { [chainId: number]: number } = {
  [mainnet.id]: 12.07,
  [optimism.id]: 2,
  [arbitrum.id]: 0.25,
  [base.id]: 2,
  [linea.id]: 3,
  [scroll.id]: 3,
};

export const ETH_RESERVED_FOR_GAS: { [chainId: number]: GN } = {
  [mainnet.id]: GN.fromDecimalString('0.1', 18),
  [optimism.id]: GN.fromDecimalString('0.005', 18),
  [arbitrum.id]: GN.fromDecimalString('0.005', 18),
  [base.id]: GN.fromDecimalString('0.005', 18),
  [linea.id]: GN.fromDecimalString('0.005', 18),
  [scroll.id]: GN.fromDecimalString('0.005', 18),
};

// TODO: better way of doing this so we don't forget to update it
export const MANAGER_NAME_MAP: { [manager: Address]: string } = {
  '0xBb5A35B80b15A8E5933fDC11646A20f6159Dd061': 'SimpleManager',
  '0x2b7E3A41Eac757CC1e8e9E61a4Ad5C9D6421516e': 'BorrowerNFTMultiManager',
  '0xA07FD687882FfE7380A044e7542bDAc6F8672Bf7': 'BorrowerNFTSimpleManager',
  '0xe1Bf15D99330E684020622856916F854c9322CB6': 'BorrowerNFTWithdrawManager',
  '0xeDE551885bC51C46Bb0da6AD0b6268396EB8aeBf': 'UniswapNFTManager',
  '0xe56B8a872bf924Ed06929cEA57EFb1FeA58CbFB7': 'UniswapNFTManager',
  '0x3Bb9F64b0e6b15dD5792A008c06E5c4Dc9d23D8f': 'FrontendManager',
  '0xB08f5f4b1B9eE99e82353c9B4B499f46d98db1B5': 'BoostManager',
  '0xC3ac51872F017cf23a815F6A952e612cB69C5482': 'BoostManager',
  '0x6BDa468b1d473028938585a04eC3c62dcFF5309B': 'Permit2Manager',
};

export const MULTICALL_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xcA11bde05977b3631167028862bE2a173976CA11',
  [optimism.id]: '0xcA11bde05977b3631167028862bE2a173976CA11',
  [arbitrum.id]: '0xcA11bde05977b3631167028862bE2a173976CA11',
  [base.id]: '0xcA11bde05977b3631167028862bE2a173976CA11',
  [linea.id]: '0xcA11bde05977b3631167028862bE2a173976CA11',
  [scroll.id]: '0xcA11bde05977b3631167028862bE2a173976CA11',
};

export const UNISWAP_FACTORY_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  [optimism.id]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  [arbitrum.id]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  [base.id]: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
  [linea.id]: '0x31FAfd4889FA1269F7a13A66eE0fB458f27D72A9',
  [scroll.id]: '0x70C62C8b8e801124A4Aa81ce07b637A3e83cb919',
};

export const UNISWAP_PERMIT2_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  [optimism.id]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  [arbitrum.id]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  [base.id]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  [linea.id]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  [scroll.id]: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
};

export const UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  [optimism.id]: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  [arbitrum.id]: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  [base.id]: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
  [linea.id]: '0x4615C383F85D0a2BbED973d83ccecf5CB7121463',
  [scroll.id]: '0xB39002E4033b162fAc607fc3471E205FA2aE5967',
};

export const ALOE_II_FACTORY_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x000000009efdB26b970bCc0085E126C9dfc16ee8',
  [optimism.id]: '0x000000009efdB26b970bCc0085E126C9dfc16ee8',
  [arbitrum.id]: '0x000000009efdB26b970bCc0085E126C9dfc16ee8',
  [base.id]: '0x000000009efdB26b970bCc0085E126C9dfc16ee8',
  [linea.id]: '0x00000000333288eBA83426245D144B966Fd7e82E',
  [scroll.id]: '0x00000000333288eBA83426245D144B966Fd7e82E',
};

export const ALOE_II_BORROWER_LENS_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xf8686eaff7106fa6b6337b4fb767557e73299aa0',
  [optimism.id]: '0xf8686eaff7106fa6b6337b4fb767557e73299aa0',
  [arbitrum.id]: '0xf8686eaff7106fa6b6337b4fb767557e73299aa0',
  [base.id]: '0xf8686eaff7106fa6b6337b4fb767557e73299aa0',
  [linea.id]: '0xf8686eaff7106fa6b6337b4fb767557e73299aa0',
  [scroll.id]: '0xf8686eaff7106fa6b6337b4fb767557e73299aa0',
};

export const ALOE_II_LENDER_LENS_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x1f36838Ac6e3922dD26f1222d75af86185f2b798',
  [optimism.id]: '0x1f36838Ac6e3922dD26f1222d75af86185f2b798',
  [arbitrum.id]: '0x1f36838Ac6e3922dD26f1222d75af86185f2b798',
  [base.id]: '0x1f36838Ac6e3922dD26f1222d75af86185f2b798',
  [linea.id]: '0xFc39498Edd3E18d5296E6584847f2580ad0e770B',
  [scroll.id]: '0xFc39498Edd3E18d5296E6584847f2580ad0e770B',
};

export const ALOE_II_ROUTER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x00000000E06A067f9eB0fbA25c965505e9594796',
  [optimism.id]: '0x00000000E06A067f9eB0fbA25c965505e9594796',
  [arbitrum.id]: '0x00000000E06A067f9eB0fbA25c965505e9594796',
  [base.id]: '0x00000000E06A067f9eB0fbA25c965505e9594796',
  [linea.id]: '0x00000000117FCd06416D60A08cb2414aD92894AC',
  [scroll.id]: '0x00000000117FCd06416D60A08cb2414aD92894AC',
};

export const ALOE_II_SIMPLE_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xBb5A35B80b15A8E5933fDC11646A20f6159Dd061',
  [optimism.id]: '0xBb5A35B80b15A8E5933fDC11646A20f6159Dd061',
  [arbitrum.id]: '0xBb5A35B80b15A8E5933fDC11646A20f6159Dd061',
  [base.id]: '0xBb5A35B80b15A8E5933fDC11646A20f6159Dd061',
  [linea.id]: '0xAA216921649D81eD098bb31FF81e64F17C779a26',
  [scroll.id]: '0xAA216921649D81eD098bb31FF81e64F17C779a26',
};

export const ALOE_II_BORROWER_NFT_MULTI_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x2b7E3A41Eac757CC1e8e9E61a4Ad5C9D6421516e',
  [optimism.id]: '0x2b7E3A41Eac757CC1e8e9E61a4Ad5C9D6421516e',
  [arbitrum.id]: '0x2b7E3A41Eac757CC1e8e9E61a4Ad5C9D6421516e',
  [base.id]: '0x2b7E3A41Eac757CC1e8e9E61a4Ad5C9D6421516e',
  [linea.id]: '0xddB1B10510C9f9486f766F8873ad611471af10c2',
  [scroll.id]: '0xddB1B10510C9f9486f766F8873ad611471af10c2',
};

export const ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xA07FD687882FfE7380A044e7542bDAc6F8672Bf7',
  [optimism.id]: '0xA07FD687882FfE7380A044e7542bDAc6F8672Bf7',
  [arbitrum.id]: '0xA07FD687882FfE7380A044e7542bDAc6F8672Bf7',
  [base.id]: '0xA07FD687882FfE7380A044e7542bDAc6F8672Bf7',
  [linea.id]: '0xc5CA365CdbD0d53198e830F2dD36a1bB6bC458Ca',
  [scroll.id]: '0xc5CA365CdbD0d53198e830F2dD36a1bB6bC458Ca',
};

export const ALOE_II_BORROWER_NFT_WITHDRAW_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xe1Bf15D99330E684020622856916F854c9322CB6',
  [optimism.id]: '0xe1Bf15D99330E684020622856916F854c9322CB6',
  [arbitrum.id]: '0xe1Bf15D99330E684020622856916F854c9322CB6',
  [base.id]: '0xe1Bf15D99330E684020622856916F854c9322CB6',
  [linea.id]: '0x119c5E8D665CD99110348E84dFDb8B428Faf7743',
  [scroll.id]: '0x119c5E8D665CD99110348E84dFDb8B428Faf7743',
};

export const ALOE_II_ORACLE_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x0000000030d51e39a2dDDb5Db50F9d74a289DFc3',
  [optimism.id]: '0x0000000030d51e39a2dDDb5Db50F9d74a289DFc3',
  [arbitrum.id]: '0x0000000030d51e39a2dDDb5Db50F9d74a289DFc3',
  [base.id]: '0x0000000030d51e39a2dDDb5Db50F9d74a289DFc3',
  [linea.id]: '0x00000000570385b76719a95Fdf27B9c7fB5Ff299',
  [scroll.id]: '0x00000000570385b76719a95Fdf27B9c7fB5Ff299',
};

export const ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xeDE551885bC51C46Bb0da6AD0b6268396EB8aeBf',
  [optimism.id]: '0xeDE551885bC51C46Bb0da6AD0b6268396EB8aeBf',
  [arbitrum.id]: '0xeDE551885bC51C46Bb0da6AD0b6268396EB8aeBf',
  [base.id]: '0xe56B8a872bf924Ed06929cEA57EFb1FeA58CbFB7',
  [linea.id]: '0x342cdE7276db11A82E0395CA55A0b9dDe40A4172',
  [scroll.id]: '0x57f70bf8982421edbc353c68ee53e93bddf84646',
};

export const ALOE_II_FRONTEND_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x3Bb9F64b0e6b15dD5792A008c06E5c4Dc9d23D8f',
  [optimism.id]: '0x3Bb9F64b0e6b15dD5792A008c06E5c4Dc9d23D8f',
  [arbitrum.id]: '0x3Bb9F64b0e6b15dD5792A008c06E5c4Dc9d23D8f',
  [base.id]: '0x3Bb9F64b0e6b15dD5792A008c06E5c4Dc9d23D8f',
  [linea.id]: '0xcF9aB200F420ae88e8828B9aC2827A67f194Ead2',
  [scroll.id]: '0xcF9aB200F420ae88e8828B9aC2827A67f194Ead2',
};

export const ALOE_II_BORROWER_NFT_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x00000000000078b629B7C06f5339060648468AA6',
  [optimism.id]: '0x00000000000078b629B7C06f5339060648468AA6',
  [arbitrum.id]: '0x00000000000078b629B7C06f5339060648468AA6',
  [base.id]: '0x00000000000078b629B7C06f5339060648468AA6',
  [linea.id]: '0x0000000000020b4328388968d7a919001939631c',
  [scroll.id]: '0x0000000000020b4328388968d7a919001939631c',
};

export const ALOE_II_BOOST_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xB08f5f4b1B9eE99e82353c9B4B499f46d98db1B5',
  [optimism.id]: '0xB08f5f4b1B9eE99e82353c9B4B499f46d98db1B5',
  [arbitrum.id]: '0xB08f5f4b1B9eE99e82353c9B4B499f46d98db1B5',
  [base.id]: '0xC3ac51872F017cf23a815F6A952e612cB69C5482',
  [linea.id]: '0x0808ebd5EC4Df230D7338061bb728D3F418dfB7D',
  [scroll.id]: '0x7faa0254a138080ddd5350b9c29af137ab5377ad',
};

export const ALOE_II_PERMIT2_MANAGER_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0x6BDa468b1d473028938585a04eC3c62dcFF5309B',
  [optimism.id]: '0x6BDa468b1d473028938585a04eC3c62dcFF5309B',
  [arbitrum.id]: '0x6BDa468b1d473028938585a04eC3c62dcFF5309B',
  [base.id]: '0x6BDa468b1d473028938585a04eC3c62dcFF5309B',
  [linea.id]: '0xDd890732Da2C677B987F949c4bBaD831D9B8f468',
  [scroll.id]: '0xDd890732Da2C677B987F949c4bBaD831D9B8f468',
};

export const ALOE_II_LIQUIDATOR_ADDRESS: { [chainId: number]: Address } = {
  [mainnet.id]: '0xC8eD78424824Ff7eA3602733909eC57c7d7F7301',
  [optimism.id]: '0xC8eD78424824Ff7eA3602733909eC57c7d7F7301',
  [arbitrum.id]: '0xC8eD78424824Ff7eA3602733909eC57c7d7F7301',
  [base.id]: '0xC8eD78424824Ff7eA3602733909eC57c7d7F7301',
  [linea.id]: '0xC8eD78424824Ff7eA3602733909eC57c7d7F7301',
};
