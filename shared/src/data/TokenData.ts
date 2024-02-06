import { Token } from './Token';
import { Address } from 'wagmi';
import { arbitrum, optimism, mainnet, goerli } from 'wagmi/chains';

import {
  ApeLogo,
  ArbLogo,
  BadgerLogo,
  BaldLogo,
  BasedLogo,
  CbEthLogo,
  ConvexLogo,
  DaiLogo,
  FraxLogo,
  GmxLogo,
  LidoLogo,
  LyraLogo,
  MagicLogo,
  MakerLogo,
  MaticLogo,
  MimLogo,
  OpLogo,
  PerpLogo,
  PoolTogetherLogo,
  RplLogo,
  SnxLogo,
  UniLogo,
  UsdcLogo,
  UsdtLogo,
  VeloLogo,
  WbtcLogo,
  WethLogo,
  WstEthLogo,
} from '../assets/svg/tokens';
import { base } from './BaseChain';

const USDC_GOERLI = new Token(
  goerli.id,
  '0x3c80ca907ee39f6c3021b66b5a55ccc18e07141a',
  6,
  'USDC',
  'Aloe Mock USDC',
  UsdcLogo
);

const WBTC_GOERLI = new Token(
  goerli.id,
  '0x886055958cdf2635ff47a2071264a3413d26f959',
  8,
  'WBTC',
  'Aloe Mock WBTC',
  WbtcLogo
);

const WETH_GOERLI = new Token(
  goerli.id,
  '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
  18,
  'WETH',
  'Aloe Mock WETH',
  WethLogo
);

const USDC_MAINNET = new Token(
  mainnet.id,
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  6,
  'USDC',
  'USD Coin',
  UsdcLogo
);

const WBTC_MAINNET = new Token(
  mainnet.id,
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  8,
  'WBTC',
  'Wrapped Bitcoin',
  WbtcLogo
);

const WETH_MAINNET = new Token(
  mainnet.id,
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  18,
  'WETH',
  'Wrapped Ether',
  WethLogo
);

const WSTETH_MAINNET = new Token(
  mainnet.id,
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
  18,
  'wstETH',
  'Wrapped Liquid Staked Ether 2.0',
  WstEthLogo
);

const MKR_MAINNET = new Token(mainnet.id, '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', 18, 'MKR', 'Maker', MakerLogo);

const UNI_MAINNET = new Token(mainnet.id, '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', 18, 'UNI', 'Uniswap', UniLogo);

const APE_MAINNET = new Token(mainnet.id, '0x4d224452801aced8b2f0aebe155379bb5d594381', 18, 'APE', 'ApeCoin', ApeLogo);

const RPL_MAINNET = new Token(
  mainnet.id,
  '0xd33526068d116ce69f19a9ee46f0bd304f21a51f',
  18,
  'RPL',
  'Rocket Pool Protocol',
  RplLogo
);

const MATIC_MAINNET = new Token(
  mainnet.id,
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
  18,
  'MATIC',
  'Matic Token',
  MaticLogo
);

const LDO_MAINNET = new Token(
  mainnet.id,
  '0x5a98fcbea516cf06857215779fd812ca3bef1b32',
  18,
  'LDO',
  'Lido DAO Token',
  LidoLogo
);

const CVX_MAINNET = new Token(
  mainnet.id,
  '0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b',
  18,
  'CVX',
  'Convex Token',
  ConvexLogo
);

const BADGER_MAINNET = new Token(
  mainnet.id,
  '0x3472a5a71965499acd81997a54bba8d852c6e53d',
  18,
  'BADGER',
  'Badger',
  BadgerLogo
);

const DAI_OPTIMISM = new Token(
  optimism.id,
  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
  18,
  'DAI',
  'Dai Stablecoin',
  DaiLogo
);

const FRAX_OPTIMISM = new Token(
  optimism.id,
  '0x2e3d870790dc77a83dd1d18184acc7439a53f475',
  18,
  'FRAX',
  'Frax',
  FraxLogo
);

const LYRA_OPTIMISM = new Token(
  optimism.id,
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
  18,
  'LYRA',
  'Lyra Token',
  LyraLogo
);

const OP_OPTIMISM = new Token(optimism.id, '0x4200000000000000000000000000000000000042', 18, 'OP', 'Optimism', OpLogo);

const PERP_OPTIMISM = new Token(
  optimism.id,
  '0x9e1028f5f1d5ede59748ffcee5532509976840e0',
  18,
  'PERP',
  'Perpetual',
  PerpLogo
);

const UNI_OPTIMISM = new Token(
  optimism.id,
  '0x6fd9d7ad17242c41f7131d257212c54a0e816691',
  18,
  'UNI',
  'Uniswap',
  UniLogo
);

const BRIDGED_USDC_OPTIMISM = new Token(
  optimism.id,
  '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
  6,
  'USDC.e',
  'USD Coin',
  UsdcLogo
);

const USDC_OPTIMISM = new Token(
  optimism.id,
  '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
  6,
  'USDC',
  'USD Coin',
  UsdcLogo
);

const USDT_OPTIMISM = new Token(
  optimism.id,
  '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
  6,
  'USDT',
  'Tether USD',
  UsdtLogo
);

const VELO_OPTIMISM = new Token(
  optimism.id,
  '0x3c8b650257cfb5f272f799f5e2b4e65093a11a05',
  18,
  'VELO',
  'Velodrome',
  VeloLogo
);

const WBTC_OPTIMISM = new Token(
  optimism.id,
  '0x68f180fcce6836688e9084f035309e29bf0a2095',
  8,
  'WBTC',
  'Wrapped Bitcoin',
  WbtcLogo
);

const WETH_OPTIMISM = new Token(
  optimism.id,
  '0x4200000000000000000000000000000000000006',
  18,
  'WETH',
  'Wrapped Ether',
  WethLogo
);

const WSTETH_OPTIMISM = new Token(
  optimism.id,
  '0x1f32b1c2345538c0c6f582fcb022739c4a194ebb',
  18,
  'wstETH',
  'Wrapped Liquid Staked Ether 2.0',
  WstEthLogo
);

const POOLTOGETHER_OPTIMISM = new Token(
  optimism.id,
  '0x395ae52bb17aef68c2888d941736a71dc6d4e125',
  18,
  'POOL',
  'PoolTogether',
  PoolTogetherLogo
);

const SNX_OPTIMISM = new Token(
  optimism.id,
  '0x8700daec35af8ff88c16bdf0418774cb3d7599b4',
  18,
  'SNX',
  'Synthetix Network Token',
  SnxLogo
);

const DAI_ARBITRUM = new Token(
  arbitrum.id,
  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
  18,
  'DAI',
  'Dai Stablecoin',
  DaiLogo
);

const GMX_ARBITRUM = new Token(arbitrum.id, '0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a', 18, 'GMX', 'GMX', GmxLogo);

const MAGIC_ARBITRUM = new Token(
  arbitrum.id,
  '0x539bde0d7dbd336b79148aa742883198bbf60342',
  18,
  'MAGIC',
  'MAGIC',
  MagicLogo
);

const MAGIC_INTERNET_MONEY_ARBITRUM = new Token(
  arbitrum.id,
  '0xfea7a6a0b346362bf88a9e4a88416b77a57d6c2a',
  18,
  'MIM',
  'Magic Internet Money',
  MimLogo
);

const BRIDGED_USDC_ARBITRUM = new Token(
  arbitrum.id,
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
  6,
  'USDC.e',
  'Bridged USDC',
  UsdcLogo
);

const USDC_ARBITRUM = new Token(
  arbitrum.id,
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  6,
  'USDC',
  'USD Coin',
  UsdcLogo
);

const USDT_ARBITRUM = new Token(
  arbitrum.id,
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
  6,
  'USDT',
  'Tether USD',
  UsdtLogo
);

const WBTC_ARBITRUM = new Token(
  arbitrum.id,
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
  8,
  'WBTC',
  'Wrapped Bitcoin',
  WbtcLogo
);

const WETH_ARBITRUM = new Token(
  arbitrum.id,
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  18,
  'WETH',
  'Wrapped Ether',
  WethLogo
);

const ARB_ARBITRUM = new Token(
  arbitrum.id,
  '0x912ce59144191c1204e64559fe8253a0e49e6548',
  18,
  'ARB',
  'Arbitrum',
  ArbLogo
);

const WETH_BASE = new Token(
  base.id,
  '0x4200000000000000000000000000000000000006',
  18,
  'WETH',
  'Wrapped Ether',
  WethLogo
);

const CBETH_BASE = new Token(
  base.id,
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22',
  18,
  'cbETH',
  'Coinbase Wrapped Staked ETH',
  CbEthLogo
);

const BASED_BASE = new Token(
  base.id,
  '0xba5e6fa2f33f3955f0cef50c63dcc84861eab663',
  18,
  'BASED',
  'based.markets',
  BasedLogo
);

const BALD_BASE = new Token(optimism.id, '0x27d2decb4bfc9c76f0309b8e88dec3a601fe25a8', 18, 'BALD', 'Bald', BaldLogo);

const TOKEN_DATA: { [chainId: number]: { [address: Address]: Token } } = {
  [mainnet.id]: {
    [USDC_MAINNET.address]: USDC_MAINNET,
    [WBTC_MAINNET.address]: WBTC_MAINNET,
    [WETH_MAINNET.address]: WETH_MAINNET,
    [WSTETH_MAINNET.address]: WSTETH_MAINNET,
    [CVX_MAINNET.address]: CVX_MAINNET,
    [BADGER_MAINNET.address]: BADGER_MAINNET,
    [MKR_MAINNET.address]: MKR_MAINNET,
    [UNI_MAINNET.address]: UNI_MAINNET,
    [APE_MAINNET.address]: APE_MAINNET,
    [RPL_MAINNET.address]: RPL_MAINNET,
    [MATIC_MAINNET.address]: MATIC_MAINNET,
    [LDO_MAINNET.address]: LDO_MAINNET,
  },
  [goerli.id]: {
    [USDC_GOERLI.address]: USDC_GOERLI,
    [WBTC_GOERLI.address]: WBTC_GOERLI,
    [WETH_GOERLI.address]: WETH_GOERLI,
  },
  [optimism.id]: {
    [BRIDGED_USDC_OPTIMISM.address]: BRIDGED_USDC_OPTIMISM,
    [DAI_OPTIMISM.address]: DAI_OPTIMISM,
    [FRAX_OPTIMISM.address]: FRAX_OPTIMISM,
    [LYRA_OPTIMISM.address]: LYRA_OPTIMISM,
    [OP_OPTIMISM.address]: OP_OPTIMISM,
    [PERP_OPTIMISM.address]: PERP_OPTIMISM,
    [POOLTOGETHER_OPTIMISM.address]: POOLTOGETHER_OPTIMISM,
    [SNX_OPTIMISM.address]: SNX_OPTIMISM,
    [UNI_OPTIMISM.address]: UNI_OPTIMISM,
    [USDC_OPTIMISM.address]: USDC_OPTIMISM,
    [USDT_OPTIMISM.address]: USDT_OPTIMISM,
    [VELO_OPTIMISM.address]: VELO_OPTIMISM,
    [WBTC_OPTIMISM.address]: WBTC_OPTIMISM,
    [WETH_OPTIMISM.address]: WETH_OPTIMISM,
    [WSTETH_OPTIMISM.address]: WSTETH_OPTIMISM,
  },
  [arbitrum.id]: {
    [ARB_ARBITRUM.address]: ARB_ARBITRUM,
    [DAI_ARBITRUM.address]: DAI_ARBITRUM,
    [GMX_ARBITRUM.address]: GMX_ARBITRUM,
    [MAGIC_ARBITRUM.address]: MAGIC_ARBITRUM,
    [MAGIC_INTERNET_MONEY_ARBITRUM.address]: MAGIC_INTERNET_MONEY_ARBITRUM,
    [USDC_ARBITRUM.address]: USDC_ARBITRUM,
    [BRIDGED_USDC_ARBITRUM.address]: BRIDGED_USDC_ARBITRUM,
    [USDT_ARBITRUM.address]: USDT_ARBITRUM,
    [WBTC_ARBITRUM.address]: WBTC_ARBITRUM,
    [WETH_ARBITRUM.address]: WETH_ARBITRUM,
  },
  [base.id]: {
    [WETH_BASE.address]: WETH_BASE,
    [CBETH_BASE.address]: CBETH_BASE,
    [BALD_BASE.address]: BALD_BASE,
    [BASED_BASE.address]: BASED_BASE,
  },
};

export function getTokens(chainId: number): Token[] {
  return Array.from(Object.values(TOKEN_DATA[chainId]));
}

export function getToken(chainId: number, address: Address): Token | undefined {
  return TOKEN_DATA[chainId][getLowercaseAddress(address)];
}

export function getTokenBySymbol(chainId: number, symbol: string): Token | undefined {
  return Object.values(TOKEN_DATA[chainId]).find((token) => token.symbol.toUpperCase() === symbol.toUpperCase());
}

function getLowercaseAddress(address: Address): Address {
  return address.toLowerCase() as Address;
}
