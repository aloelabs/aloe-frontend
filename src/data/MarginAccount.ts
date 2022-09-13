import { FeeTier, NumericFeeTierToEnum } from './FeeTier';
import { GetTokenData, TokenData } from './TokenData';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { BigNumber, ethers } from 'ethers';
import Big from 'big.js';
import JSBI from 'jsbi';
import { makeEtherscanRequest } from '../util/Etherscan';
import { BIGQ96 } from './constants/Values';
import { toBig } from '../util/Numbers';
import { ALOE_II_FACTORY_ADDRESS_GOERLI } from './constants/Addresses';
import { UniswapPosition } from './Actions';
import { TickMath } from '@uniswap/v3-sdk';
import { getAmountsForLiquidity, getValueOfLiquidity } from '../util/Uniswap';

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
 * For the use-cases that require all of the data
 */
export type MarginAccount = {
  address: string;
  uniswapPool: string;
  token0: TokenData;
  token1: TokenData;
  feeTier: FeeTier;
  assets: Assets;
  liabilities: Liabilities;
  kitty0: TokenData;
  kitty1: TokenData;
  sqrtPriceX96: Big;
  tickAtLastModify: number;
  includeKittyReceipts: boolean;
};

export type LiquidationThresholds = {
  lower: number;
  upper: number;
};

/**
 * For the use-cases that may not require all of the data
 * (When we don't want to fetch more than we need)
 */
 export type MarginAccountPreview = Omit<MarginAccount, 'kitty0' | 'kitty1' | 'sqrtPriceX96' | 'tickAtLastModify' | 'includeKittyReceipts'>;

export async function getMarginAccountsForUser(
  userAddress: string,
  provider: ethers.providers.Provider
): Promise<{ address: string; uniswapPool: string }[]> {
  const etherscanResult = await makeEtherscanRequest(
    7569633,
    ALOE_II_FACTORY_ADDRESS_GOERLI,
    ['0x9d919356967ac224401bdb3794d4f477506d9186bd4dab6abf7559ec9f14bd78', null, null, `0x000000000000000000000000${userAddress.slice(2)}`],
    true,
    'api-goerli'
  );
  if (!Array.isArray(etherscanResult.data.result)) return [];

  const accounts: { address: string; uniswapPool: string }[] = etherscanResult.data.result.map((item: any) => {
    return {
      address: item.topics[2].slice(0, 2) + item.topics[2].slice(26),
      uniswapPool: item.topics[1].slice(26),
    };
  });

  return accounts;
}

export async function resolveUniswapPools(marginAccounts: { address: string; uniswapPool: string }[], provider: ethers.providers.BaseProvider) {
  const uniqueUniswapPools = new Set(marginAccounts.map((x) => x.uniswapPool));
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

export async function fetchMarginAccountPreviews(
  marginAccountLensContract: ethers.Contract,
  provider: ethers.providers.BaseProvider,
  userAddress: string,
): Promise<MarginAccountPreview[]> {
  const marginAccountsAddresses = await getMarginAccountsForUser(userAddress, provider);
  const uniswapPoolDataMap = await resolveUniswapPools(marginAccountsAddresses, provider);
  const marginAccounts: Promise<MarginAccountPreview>[] = marginAccountsAddresses.map(
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
          .div(10 ** 18) // TODO is this safe, or should we be using kitty0.decimals?
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
      return { address: accountAddress, uniswapPool, token0, token1, feeTier, assets, liabilities };
    }
  );
  return Promise.all(marginAccounts);
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
    marginAccountLensContract.getLiabilities(marginAccountAddress),
    marginAccountContract.packedSlot(),
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
  const packedSlot = results[7]

  const assets: Assets = {
    token0Raw: toBig(assetsData[0])
      .div(10 ** token0.decimals)
      .toNumber(),
    token1Raw: toBig(assetsData[1])
      .div(10 ** token1.decimals)
      .toNumber(),
    token0Plus: toBig(assetsData[2])
      .div(10 ** kitty0.decimals)
      .toNumber(),
    token1Plus: toBig(assetsData[3])
      .div(10 ** kitty1.decimals)
      .toNumber(),
    uni0: toBig(assetsData[4])
      .div(10 ** token0.decimals)
      .toNumber(),
    uni1: toBig(assetsData[5])
      .div(10 ** token1.decimals)
      .toNumber(),
  };
  const liabilities: Liabilities = {
    amount0: toBig(liabilitiesData[0])
      .div(10 ** token0.decimals)
      .toNumber(),
    amount1: toBig(liabilitiesData[1])
      .div(10 ** token1.decimals)
      .toNumber(),
  };
  return {
    address: marginAccountAddress,
    uniswapPool: uniswapPool,
    token0: token0,
    token1: token1,
    kitty0: kitty0,
    kitty1: kitty1,
    feeTier: NumericFeeTierToEnum(feeTier),
    assets: assets,
    liabilities: liabilities,
    sqrtPriceX96: toBig(slot0.sqrtPriceX96),
    tickAtLastModify: packedSlot.tickAtLastModify,
    includeKittyReceipts: packedSlot.includeKittyReceipts,
  };
}

export function sqrtRatioToPrice(sqrtPriceX96: Big, token0Decimals: number, token1Decimals: number): number {
  return sqrtPriceX96
    .mul(sqrtPriceX96)
    .div(BIGQ96)
    .div(BIGQ96)
    .mul(10 ** (token0Decimals - token1Decimals))
    .toNumber();
}

export function priceToSqrtRatio(price: number, token0Decimals: number, token1Decimals: number): Big {
  return new Big(price).mul(10 ** (token1Decimals - token0Decimals)).sqrt().mul(BIGQ96);
}

const MIN_SIGMA = 0.02;
const MAX_SIGMA = 0.15;
const SIGMA_B = 2;

function _computeProbePrices(
  sqrtMeanPriceX96: Big,
  sigma: number
): [Big, Big] {
  sigma = Math.min(Math.max(MIN_SIGMA, sigma), MAX_SIGMA);
  sigma *= SIGMA_B;

  const a = sqrtMeanPriceX96.mul(new Big((1 - sigma) * 1e18).sqrt()).div(1e9);
  const b = sqrtMeanPriceX96.mul(new Big((1 + sigma) * 1e18).sqrt()).div(1e9);
  return [a, b];
}

export function getAssets(
  marginAccount: MarginAccount,
  uniswapPositions: UniswapPosition[],
  a: Big,
  b: Big,
  c: Big,
) {
  const tickA = TickMath.getTickAtSqrtRatio(JSBI.BigInt(a.toFixed(0)));
  const tickB = TickMath.getTickAtSqrtRatio(JSBI.BigInt(b.toFixed(0)));
  const tickC = TickMath.getTickAtSqrtRatio(JSBI.BigInt(c.toFixed(0)));

  let fixed0 = marginAccount.assets.token0Raw;
  let fixed1 = marginAccount.assets.token1Raw;
  if (marginAccount.includeKittyReceipts) {
    fixed0 += marginAccount.assets.token0Plus;
    fixed1 += marginAccount.assets.token1Plus;
  }

  let fluid1A = 0;
  let fluid1B = 0;
  let fluid0C = 0;
  let fluid1C = 0;

  for (const position of uniswapPositions) {
    const {liquidity, lower, upper} = position;
    if (lower === null || upper === null) {
      console.error('Attempted to compute liquidation thresholds for account with malformed Uniswap Position');
      console.error(position);
      continue;
    }

    fluid1A += getValueOfLiquidity(liquidity, lower, upper, tickA, marginAccount.token1.decimals);
    fluid1B += getValueOfLiquidity(liquidity, lower, upper, tickB, marginAccount.token1.decimals);
    const temp = getAmountsForLiquidity(liquidity, lower, upper, tickC, marginAccount.token0.decimals, marginAccount.token1.decimals);
    fluid0C += temp[0];
    fluid1C += temp[1];
  }

  return { fixed0, fixed1, fluid1A, fluid1B, fluid0C, fluid1C }
}

function _computeLiquidationIncentive(
  assets0: number,
  assets1: number,
  liabilities0: number,
  liabilities1: number,
  token0Decimals: number,
  token1Decimals: number,
  sqrtPriceX96: Big
): number {
  const price = sqrtRatioToPrice(sqrtPriceX96, token0Decimals, token1Decimals);

  let reward = 0;
  if (liabilities0 > assets0) {
    const shortfall = liabilities0 - assets0;
    reward += 0.05 * shortfall * price;
  }
  if (liabilities1 > assets1) {
    const shortfall = liabilities1 - assets1;
    reward += 0.05 * shortfall;
  }
  return reward;
}

export function isSolvent(
  marginAccount: MarginAccount,
  uniswapPositions: UniswapPosition[],
  sqrtPriceX96: Big,
  sigma: number
) {
  const token0Decimals = marginAccount.token0.decimals;
  const token1Decimals = marginAccount.token1.decimals;

  const [a, b] = _computeProbePrices(
    sqrtPriceX96,
    marginAccount.includeKittyReceipts ? sigma * Math.sqrt(24) : sigma
  );
  const priceA = sqrtRatioToPrice(a, token0Decimals, token1Decimals);
  const priceB = sqrtRatioToPrice(b, token0Decimals, token1Decimals);

  const mem = getAssets(marginAccount, uniswapPositions, a, b, sqrtPriceX96);
  let liabilities0 = marginAccount.liabilities.amount0;
  let liabilities1 = marginAccount.liabilities.amount1;

  const liquidationIncentive = _computeLiquidationIncentive(
    mem.fixed0 + mem.fluid0C,
    mem.fixed1 + mem.fluid1C,
    liabilities0,
    liabilities1,
    token0Decimals,
    token1Decimals,
    sqrtPriceX96
  );

  liabilities0 = liabilities0 * 1.005;
  liabilities1 = liabilities1 * 1.005 + liquidationIncentive;

  const liabilitiesA = liabilities1 + (liabilities0 * priceA);
  const assetsA = mem.fluid1A + mem.fixed1 + (mem.fixed0 * priceA);
  
  const liabilitiesB = liabilities1 + (liabilities0 * priceB);
  const assetsB = mem.fluid1B + mem.fixed1 + (mem.fixed0 * priceB);

  return {
    priceA,
    priceB,
    assetsA,
    assetsB, 
    liabilitiesA,
    liabilitiesB,
    atA: assetsA >= liabilitiesA,
    atB: assetsB >= liabilitiesB,
  };
}

export function computeLiquidationThresholds(
  marginAccount: MarginAccount,
  uniswapPositions: UniswapPosition[],
  sigma: number
): { begin: number, end: number } {

  let result = {
    begin: 0,
    end: 0,
  }

  const MINPRICE = new Big(TickMath.MIN_SQRT_RATIO.toString(10)).mul(1.05);
  const MAXPRICE = new Big(TickMath.MAX_SQRT_RATIO.toString()).div(1.05);

  // Binary search precision
  const iterations = 30;
  
  // Find lower liuidation threshold
  const isSolventAtMin = isSolvent(marginAccount, uniswapPositions, MINPRICE, sigma);
  if (isSolventAtMin.atA && isSolventAtMin.atB) { // if solvent at beginning, short-circuit
    result.begin = MINPRICE.toNumber();
  } else {
    // Start binary search
    let lowerBoundPrice = MINPRICE;
    let upperBoundPrice = marginAccount.sqrtPriceX96;
    let searchPrice: Big = new Big(0);
    for (let i = 0; i < iterations; i++) {
      searchPrice = lowerBoundPrice.add(upperBoundPrice).div(2);
      const isSolventAtSearchPrice = isSolvent(marginAccount, uniswapPositions, searchPrice, sigma);
      const isLiquidatableAtSearchPrice = !isSolventAtSearchPrice.atA || !isSolventAtSearchPrice.atB;
      if (isLiquidatableAtSearchPrice) { // liquidation threshold is lower
        upperBoundPrice = searchPrice;
      } else { // liquidation threshold is higher
        lowerBoundPrice = searchPrice;
      }
    }
    result.begin = searchPrice.toNumber();
  }

// Find upper liquidation threshold
const isSolventAtMax = isSolvent(marginAccount, uniswapPositions, MAXPRICE, sigma);
if (isSolventAtMax.atA && isSolventAtMax.atB) { // if solvent at end, short-circuit
  result.end = MAXPRICE.toNumber();
} else {
  // Start binary search
  let lowerBoundPrice = marginAccount.sqrtPriceX96;
  let upperBoundPrice = MAXPRICE;
  let searchPrice: Big = new Big(0);
  for (let i = 0; i < iterations; i++) {
    searchPrice = lowerBoundPrice.add(upperBoundPrice).div(2);
    const isSolventAtSearchPrice = isSolvent(marginAccount, uniswapPositions, searchPrice, sigma);
    const isLiquidatableAtSearchPrice = !isSolventAtSearchPrice.atA || !isSolventAtSearchPrice.atB;
    if (isLiquidatableAtSearchPrice) { // liquidation threshold is higher
      lowerBoundPrice = searchPrice;
    } else { // liquidation threshold is lower
      upperBoundPrice = searchPrice;
    }
  }
  result.end = searchPrice.toNumber();
}

  return result;
}

export function sumAssetsPerToken(assets: Assets): [number, number] {
  return [assets.token0Raw + assets.token0Plus + assets.uni0, assets.token1Raw + assets.token1Plus + assets.uni1];
}
