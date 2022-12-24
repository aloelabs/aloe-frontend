import { Address, chain } from 'wagmi';

import { UsdcLogo, WbtcLogo, WethLogo } from '../assets/svg/tokens';
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
  '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
  6,
  'USDC',
  'USD Coin',
  UsdcLogo
);

const USDC_ARBITRUM = new Token(
  chain.arbitrum.id,
  '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
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
  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
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
  '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
  8,
  'WBTC',
  'Wrapped Bitcoin',
  WbtcLogo
);

const WBTC_ARBITRUM = new Token(
  chain.arbitrum.id,
  '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
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
  const token = Object.values(TOKEN_DATA[chainId]).find((token) => token.ticker === ticker);
  if (!token) {
    throw new Error(`Could not find token with ticker ${ticker}`);
  }
  return token;
}

function getLowercaseAddress(address: Address): Address {
  return address.toLowerCase() as Address;
}
