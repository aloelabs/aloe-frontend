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
