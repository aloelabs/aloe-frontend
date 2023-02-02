import { Address, chain } from 'wagmi';

import {
  UsdcLogo,
  WbtcLogo,
  WethLogo,
  VeloLogo,
  DaiLogo,
  OpLogo,
  WstEthLogo,
  FraxLogo,
  UniLogo,
  LyraLogo,
  PerpLogo,
} from '../assets/svg/tokens';
import { Token } from './Token';

const USDC_OPTIMISM = new Token(
  chain.optimism.id,
  '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
  6,
  'USDC',
  'USD Coin',
  UsdcLogo
);

const WETH_OPTIMISM = new Token(
  chain.optimism.id,
  '0x4200000000000000000000000000000000000006',
  18,
  'WETH',
  'Wrapped Ether',
  WethLogo
);

const WBTC_OPTIMISM = new Token(
  chain.optimism.id,
  '0x68f180fcce6836688e9084f035309e29bf0a2095',
  8,
  'WBTC',
  'Wrapped Bitcoin',
  WbtcLogo
);

const VELO_OPTIMISM = new Token(
  chain.optimism.id,
  '0x3c8b650257cfb5f272f799f5e2b4e65093a11a05',
  18,
  'VELO',
  'Velodrome',
  VeloLogo
);

const DAI_OPTIMISM = new Token(
  chain.optimism.id,
  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
  18,
  'DAI',
  'Dai Stablecoin',
  DaiLogo
);

const OP_OPTIMISM = new Token(
  chain.optimism.id,
  '0x4200000000000000000000000000000000000042',
  18,
  'OP',
  'Optimism',
  OpLogo
);

const WSTETH_OPTIMISM = new Token(
  chain.optimism.id,
  '0x1f32b1c2345538c0c6f582fcb022739c4a194ebb',
  18,
  'wstETH',
  'Wrapped Liquid Staked Ether 2.0',
  WstEthLogo
);

const FRAX_OPTIMISM = new Token(
  chain.optimism.id,
  '0x2e3d870790dc77a83dd1d18184acc7439a53f475',
  18,
  'FRAX',
  'Frax',
  FraxLogo
);

const UNI_OPTIMISM = new Token(
  chain.optimism.id,
  '0x6fd9d7ad17242c41f7131d257212c54a0e816691',
  18,
  'UNI',
  'Uniswap',
  UniLogo
);

const LYRA_OPTIMISM = new Token(
  chain.optimism.id,
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
  18,
  'LYRA',
  'Lyra Token',
  LyraLogo
);

const PERP_OPTIMISM = new Token(
  chain.optimism.id,
  '0x9e1028f5f1d5ede59748ffcee5532509976840e0',
  18,
  'PERP',
  'Perpetual',
  PerpLogo
);

const USDC_GOERLI = new Token(
  chain.goerli.id,
  '0x3c80ca907ee39f6c3021b66b5a55ccc18e07141a',
  6,
  'USDC',
  'Aloe Mock USDC',
  UsdcLogo
);

const USDC_MAINNET = new Token(
  chain.mainnet.id,
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  6,
  'USDC',
  'USD Coin',
  UsdcLogo
);

const WETH_GOERLI = new Token(
  chain.goerli.id,
  '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
  18,
  'WETH',
  'Aloe Mock WETH',
  WethLogo
);

const WETH_MAINNET = new Token(
  chain.mainnet.id,
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  18,
  'WETH',
  'Wrapped Ether',
  WethLogo
);

const WBTC_GOERLI = new Token(
  chain.goerli.id,
  '0x886055958cdf2635ff47a2071264a3413d26f959',
  8,
  'WBTC',
  'Aloe Mock WBTC',
  WbtcLogo
);

const WBTC_MAINNET = new Token(
  chain.mainnet.id,
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  8,
  'WBTC',
  'Wrapped Bitcoin',
  WbtcLogo
);

const TOKEN_DATA: { [chainId: number]: { [address: Address]: Token } } = {
  [chain.mainnet.id]: {
    [USDC_MAINNET.address]: USDC_MAINNET,
    [WETH_MAINNET.address]: WETH_MAINNET,
    [WBTC_MAINNET.address]: WBTC_MAINNET,
  },
  [chain.goerli.id]: {
    [USDC_GOERLI.address]: USDC_GOERLI,
    [WETH_GOERLI.address]: WETH_GOERLI,
    [WBTC_GOERLI.address]: WBTC_GOERLI,
  },
  [chain.optimism.id]: {
    [USDC_OPTIMISM.address]: USDC_OPTIMISM,
    [WETH_OPTIMISM.address]: WETH_OPTIMISM,
    [WBTC_OPTIMISM.address]: WBTC_OPTIMISM,
    [VELO_OPTIMISM.address]: VELO_OPTIMISM,
    [DAI_OPTIMISM.address]: DAI_OPTIMISM,
    [OP_OPTIMISM.address]: OP_OPTIMISM,
    [WSTETH_OPTIMISM.address]: WSTETH_OPTIMISM,
    [FRAX_OPTIMISM.address]: FRAX_OPTIMISM,
    [UNI_OPTIMISM.address]: UNI_OPTIMISM,
    [LYRA_OPTIMISM.address]: LYRA_OPTIMISM,
    [PERP_OPTIMISM.address]: PERP_OPTIMISM,
  },
};

export function getTokens(chainId: number): Token[] {
  return Array.from(Object.values(TOKEN_DATA[chainId]));
}

export function getToken(chainId: number, address: Address): Token {
  return TOKEN_DATA[chainId][getLowercaseAddress(address)];
}

export function getTokenByTicker(chainId: number, ticker: string): Token {
  const token = Object.values(TOKEN_DATA[chainId]).find((token) => token.ticker === ticker);
  if (!token) {
    throw new Error(`Could not find token with ticker ${ticker}`);
  }
  return token;
}

function getLowercaseAddress(address: Address): Address {
  return address.toLowerCase() as Address;
}
