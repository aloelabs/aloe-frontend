import { FeiLogo, UsdcLogo, WbtcLogo, WethLogo, TribeLogo, RaiLogo, LooksLogo } from '../assets/svg/tokens';

export type TokenData = {
  address: string;
  decimals: number;
  ticker?: string;
  name?: string;
  iconPath?: string;
  // TODO: Move this out of here, so that other uses of tokendata don't have to async wait to draw
};

const TokenDataMap = new Map<string, TokenData>([
  // Mock USDC (Goerli)
  [
    '0x3c80ca907ee39f6c3021b66b5a55ccc18e07141a',
    {
      address: '0x3c80ca907ee39f6c3021b66b5a55ccc18e07141a',
      name: 'Aloe Mock USDC',
      ticker: 'USDC',
      iconPath: UsdcLogo,
      decimals: 6,
    },
  ],
  // WETH (Goerli)
  [
    '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
    {
      address: '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
      name: 'Wrapped Ether',
      ticker: 'WETH',
      iconPath: WethLogo,
      decimals: 18,
    },
  ],
  // USDC
  [
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      name: 'USD Coin',
      ticker: 'USDC',
      iconPath: UsdcLogo,
      decimals: 6,
    },
  ],
  // USDC+ (Goerli)
  [
    '0xad5efe0d12c1b3fe87a171c83ce4cca4d85d381a',
    {
      address: '0xad5efe0d12c1b3fe87a171c83ce4cca4d85d381a',
      name: 'Aloe II USD Coin',
      ticker: 'USDC+',
      iconPath: UsdcLogo,
      decimals: 6,
    },
  ],
  // WETH
  [
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    {
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      name: 'Wrapped Ether',
      ticker: 'WETH',
      iconPath: WethLogo,
      decimals: 18,
    },
  ],
  // WETH+ (Goerli)
  [
    '0xea1e4f047caaa24cf855ceeeda77cd353af81aec',
    {
      address: '0xea1e4f047caaa24cf855ceeeda77cd353af81aec',
      name: 'Aloe II Wrapped Ether',
      ticker: 'WETH+',
      iconPath: WethLogo,
      decimals: 18,
    },
  ],
  // WBTC
  [
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    {
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      name: 'Wrapped Bitcoin',
      ticker: 'WBTC',
      iconPath: WbtcLogo,
      decimals: 8,
    },
  ],
  // Fei
  [
    '0x956f47f50a910163d8bf957cf5846d573e7f87ca',
    {
      address: '0x956f47f50a910163d8bf957cf5846d573e7f87ca',
      name: 'Fei USD',
      ticker: 'FEI',
      iconPath: FeiLogo,
      decimals: 18,
    },
  ],
  // Tribe
  [
    '0xc7283b66eb1eb5fb86327f08e1b5816b0720212b',
    {
      address: '0xc7283b66eb1eb5fb86327f08e1b5816b0720212b',
      name: 'Tribe',
      ticker: 'TRIBE',
      iconPath: TribeLogo,
      decimals: 18,
    },
  ],
  // Rai
  [
    '0x03ab458634910aad20ef5f1c8ee96f1d6ac54919',
    {
      address: '0x03ab458634910aad20ef5f1c8ee96f1d6ac54919',
      name: 'Rai Reflex Index',
      ticker: 'RAI',
      iconPath: RaiLogo,
      decimals: 18,
    },
  ],
  // Looks
  [
    '0xf4d2888d29d722226fafa5d9b24f9164c092421e',
    {
      address: '0xf4d2888d29d722226fafa5d9b24f9164c092421e',
      name: 'LooksRare Token',
      ticker: 'LOOKS',
      iconPath: LooksLogo,
      decimals: 18,
    },
  ],
]);

export function getTokens(): TokenData[] {
  return Array.from(TokenDataMap.values());
}

export function GetTokenData(address: string): TokenData {
  if (TokenDataMap.has(address.toLowerCase())) {
    return TokenDataMap.get(address.toLowerCase())!;
  } else
    return {
      address: address,
      decimals: 0,
    };
}
