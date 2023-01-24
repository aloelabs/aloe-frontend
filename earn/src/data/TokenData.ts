import { Address, chain } from 'wagmi';

import { DaiLogo, OpLogo, UsdcLogo, VeloLogo, WbtcLogo, WethLogo, WstEthLogo } from '../assets/svg/tokens';
import { Token } from './Token';

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

const USDC_OPTIMISM = new Token(
  chain.optimism.id,
  '0x7f5c764cbc14f9669b88837ca1490cca17c31607',
  6,
  'USDC',
  'USD Coin',
  UsdcLogo
);

const USDC_ARBITRUM = new Token(
  chain.arbitrum.id,
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
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

const WETH_OPTIMISM = new Token(
  chain.optimism.id,
  '0x4200000000000000000000000000000000000006',
  18,
  'WETH',
  'Wrapped Ether',
  WethLogo
);

const WETH_ARBITRUM = new Token(
  chain.arbitrum.id,
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
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

const WBTC_OPTIMISM = new Token(
  chain.optimism.id,
  '0x68f180fcce6836688e9084f035309e29bf0a2095',
  8,
  'WBTC',
  'Wrapped Bitcoin',
  WbtcLogo
);

const WBTC_ARBITRUM = new Token(
  chain.arbitrum.id,
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
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
    [DAI_OPTIMISM.address]: DAI_OPTIMISM,
    [VELO_OPTIMISM.address]: VELO_OPTIMISM,
    [OP_OPTIMISM.address]: OP_OPTIMISM,
    [WSTETH_OPTIMISM.address]: WSTETH_OPTIMISM,
  },
  [chain.arbitrum.id]: {
    [USDC_ARBITRUM.address]: USDC_ARBITRUM,
    [WETH_ARBITRUM.address]: WETH_ARBITRUM,
    [WBTC_ARBITRUM.address]: WBTC_ARBITRUM,
  },
};

export function getTokens(chainId: number): Token[] {
  return Array.from(Object.values(TOKEN_DATA[chainId]));
}

export function getToken(chainId: number, address: Address): Token {
  return TOKEN_DATA[chainId][getLowercaseAddress(address)];
}

export function getTokenByTicker(chainId: number, ticker: string): Token {
  const token = Object.values(TOKEN_DATA[chainId]).find((token) => token.ticker.toUpperCase() === ticker.toUpperCase());
  if (!token) {
    throw new Error(`Could not find token with ticker ${ticker}`);
  }
  return token;
}

function getLowercaseAddress(address: Address): Address {
  return address.toLowerCase() as Address;
}
