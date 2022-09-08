import { FeeTier, NumericFeeTierToEnum } from './FeeTier';
import { GetTokenData, TokenData } from './TokenData';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import { BigNumber, ethers } from 'ethers';
import Big from 'big.js';
import { TypeFlags } from 'typescript';
import { makeEtherscanRequest } from '../util/Etherscan';
import { BIGQ96 } from './constants/Values';

export type Assets = {
  token0Raw: number;
  token1Raw: number;
  token0Plus: number;
  token1Plus: number;
  uni0: number;
  uni1: number;
};

export type Liabilities = {
  amount0: number;
  amount1: number;
};

/**
 * For the use-cases that may not require all of the data
 * (When we don't want to fetch more than we need)
 */
export type MarginAccountLite = {
  address: string;
  token0: TokenData;
  token1: TokenData;
  feeTier: FeeTier;
  assets: Assets;
  liabilities: Liabilities;
};

/**
 * For the use-cases that require all of the data
 */
export type MarginAccount = MarginAccountLite & {
  kitty0: TokenData;
  kitty1: TokenData;
  sqrtPriceX96: Big;
};

export async function getMarginAccountsForUser(
  userAddress: string,
  provider: ethers.providers.Provider
): Promise<{ address: string; uniswapPool: string }[]> {
  const etherscanResult = await makeEtherscanRequest(
    7537163,
    '0x9F6d4681fD8c557e5dC75b6713078233e98CA351', // TODO replace with constant for FACTORY address
    ['0x2e4e957c1260adb001f2d118cbfb21f455e78760f52247e8b9490521ac2254aa'],
    true,
    'api-goerli'
  );
  if (!Array.isArray(etherscanResult.data.result)) return [];

  const accounts: { address: string; uniswapPool: string }[] = etherscanResult.data.result.map((item: any) => {
    return {
      address: item.topics[2].slice(26),
      uniswapPool: item.topics[1].slice(26),
    };
  });

  const accountOwners = await Promise.all(
    accounts.map((account) => {
      const contract = new ethers.Contract(account.address, MarginAccountABI, provider);
      return contract.OWNER();
    })
  );

  return accounts.filter((_, i) => accountOwners[i] === userAddress);
}

export async function resolveUniswapPools(fetchedMarginAccounts: { address: string; uniswapPool: string }[], provider: ethers.providers.BaseProvider) {
  const uniqueUniswapPools = new Set(fetchedMarginAccounts.map((x) => x.uniswapPool));
  // create an array to hold all the Promises we're about to create
  const uniswapPoolData: Promise<[string, { token0: string; token1: string; feeTier: number }]>[] = [];
  // for each pool, create a Promise that returns a tuple: (poolAddress, otherData)
  uniqueUniswapPools.forEach((pool) => {
    async function getUniswapPoolData(): Promise<[string, { token0: string; token1: string; feeTier: number }]> {
      const contract = new ethers.Contract(pool, UniswapV3PoolABI, provider);
      const [token0, token1, feeTier] = await Promise.all([contract.token0(), contract.token1(), contract.fee()]);
      //     |key|  |          value           |
      return [pool, { token0, token1, feeTier }];
    }
    uniswapPoolData.push(getUniswapPoolData());
  });
  // resolve all the Promised tuples and turn them into a Map
  return Object.fromEntries(await Promise.all(uniswapPoolData));
}

export async function fetchMarginAccountLites(
  marginAccountLensContract: ethers.Contract,
  provider: ethers.providers.BaseProvider,
  userAddress: string,
): Promise<MarginAccountLite[]> {
  const fetchedMarginAccountsAddresses = await getMarginAccountsForUser(userAddress, provider);
  const uniswapPoolDataMap = await resolveUniswapPools(fetchedMarginAccountsAddresses, provider);
  const fetchedMarginAccounts: Promise<MarginAccountLite>[] = fetchedMarginAccountsAddresses.map(
    async ({ address: accountAddress, uniswapPool }) => {
      const token0 = GetTokenData(uniswapPoolDataMap[uniswapPool].token0);
      const token1 = GetTokenData(uniswapPoolDataMap[uniswapPool].token1);
      const feeTier = NumericFeeTierToEnum(uniswapPoolDataMap[uniswapPool].feeTier);

      const assetsData: BigNumber[] = await marginAccountLensContract.getAssets(accountAddress);
      const liabilitiesData: BigNumber[] = await marginAccountLensContract.getLiabilities(accountAddress);
      const assets: Assets = {
        token0Raw: Big(assetsData[0].toString())
          .div(10 ** token0.decimals)
          .toNumber(),
        token1Raw: Big(assetsData[1].toString())
          .div(10 ** token1.decimals)
          .toNumber(),
        token0Plus: Big(assetsData[4].toString())
          .div(10 ** 18)
          .toNumber(),
        token1Plus: Big(assetsData[5].toString())
          .div(10 ** 18)
          .toNumber(),
        uni0: Big(assetsData[2].toString())
          .div(10 ** token0.decimals)
          .toNumber(),
        uni1: Big(assetsData[3].toString())
          .div(10 ** token1.decimals)
          .toNumber(),
      };
      const liabilities: Liabilities = {
        amount0: Big(liabilitiesData[0].toString())
          .div(10 ** token0.decimals)
          .toNumber(),
        amount1: Big(liabilitiesData[1].toString())
          .div(10 ** token1.decimals)
          .toNumber(),
      };
      return { address: accountAddress, token0, token1, feeTier, assets, liabilities };
    }
  );
  return Promise.all(fetchedMarginAccounts);
}

export async function fetchMarginAccount(
  marginAccountContract: ethers.Contract,
  marginAccountLensContract: ethers.Contract,
  provider: ethers.providers.BaseProvider,
  marginAccountAddress: string
): Promise<MarginAccount> {
  const results = await Promise.all([
    marginAccountContract.TOKEN0(),
    marginAccountContract.TOKEN1(),
    marginAccountContract.KITTY0(),
    marginAccountContract.KITTY1(),
    marginAccountContract.UNISWAP_POOL(),
    marginAccountLensContract.getAssets(marginAccountAddress),
    await marginAccountLensContract.getLiabilities(marginAccountAddress),
  ]);

  const uniswapPool = results[4];
  const uniswapPoolContract = new ethers.Contract(uniswapPool, UniswapV3PoolABI, provider);
  const [feeTier, slot0] = await Promise.all([uniswapPoolContract.fee(), uniswapPoolContract.slot0()]);

  const token0 = GetTokenData(results[0] as string);
  const token1 = GetTokenData(results[1] as string);
  const kitty0 = GetTokenData(results[2] as string);
  const kitty1 = GetTokenData(results[3] as string);
  const assetsData = results[5] as BigNumber[];
  const liabilitiesData = results[6] as BigNumber[];

  const assets: Assets = {
    token0Raw: Big(assetsData[0].toString())
      .div(10 ** token0.decimals)
      .toNumber(),
    token1Raw: Big(assetsData[1].toString())
      .div(10 ** token1.decimals)
      .toNumber(),
    token0Plus: Big(assetsData[2].toString())
      .div(10 ** 18)
      .toNumber(),
    token1Plus: Big(assetsData[3].toString())
      .div(10 ** 18)
      .toNumber(),
    uni0: Big(assetsData[4].toString())
      .div(10 ** token0.decimals)
      .toNumber(),
    uni1: Big(assetsData[5].toString())
      .div(10 ** token1.decimals)
      .toNumber(),
  };
  const liabilities: Liabilities = {
    amount0: Big(liabilitiesData[0].toString())
      .div(10 ** token0.decimals)
      .toNumber(),
    amount1: Big(liabilitiesData[1].toString())
      .div(10 ** token1.decimals)
      .toNumber(),
  };
  return {
    address: marginAccountAddress,
    token0: token0,
    token1: token1,
    kitty0: kitty0,
    kitty1: kitty1,
    feeTier: NumericFeeTierToEnum(feeTier),
    assets: assets,
    liabilities: liabilities,
    sqrtPriceX96: new Big(slot0.sqrtPriceX96.toString()),
  };
}

export function isSolvent(
  assets: Assets,
  liabilities: Liabilities,
  sqrtPriceX96: Big,
  token0: TokenData,
  token1: TokenData
): boolean {
  const priceX96 = sqrtPriceX96.mul(sqrtPriceX96).div(BIGQ96);

  const assets0 = assets.token0Raw + assets.token0Plus + assets.uni0;
  const assets1 = assets.token1Raw + assets.token1Plus + assets.uni1;

  const assets_1 =
    assets1 +
    priceX96
      .mul(assets0)
      .mul(10 ** token0.decimals)
      .div(BIGQ96)
      .div(10 ** token1.decimals)
      .toNumber();
  const liabilities_1 =
    liabilities.amount1 +
    priceX96
      .mul(liabilities.amount0)
      .mul(10 ** token0.decimals)
      .div(BIGQ96)
      .div(10 ** token1.decimals)
      .toNumber();

  return assets_1 >= 1.05 * liabilities_1;
}

export function sumAssetsPerToken(assets: Assets): [number, number] {
  return [assets.token0Raw + assets.token0Plus + assets.uni0, assets.token1Raw + assets.token1Plus + assets.uni1];
}
