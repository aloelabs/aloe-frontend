import Big from 'big.js';
import { secondsInYear } from 'date-fns';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { Address, Chain } from 'wagmi';

import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import VolatilityOracleABI from '../assets/abis/VolatilityOracle.json';
import { makeEtherscanRequest } from '../util/Etherscan';
import { toBig } from '../util/Numbers';
// import { getAmountsForLiquidity, getValueOfLiquidity } from '../util/Uniswap';
// import { UniswapPosition } from './actions/Actions';
import { ALOE_II_FACTORY_ADDRESS, ALOE_II_ORACLE } from './constants/Addresses';
import { TOPIC0_CREATE_BORROWER_EVENT } from './constants/Signatures';
import { BIGQ96 } from './constants/Values';
import { Token } from './Token';
import { getToken } from './TokenData';

export type UniswapPosition = {
  lower: number;
  upper: number;
  liquidity: JSBI;
};

export type UniswapPositionPrior = Omit<UniswapPosition, 'amount0' | 'amount1' | 'liquidity'>;

export type Assets = {
  token0Raw: number;
  token1Raw: number;
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
  token0: Token;
  token1: Token;
  feeTier: FeeTier;
  assets: Assets;
  liabilities: Liabilities;
  sqrtPriceX96: Big;
  health: number;
  lender0: Address;
  lender1: Address;
  iv: number;
};

export type MarketInfo = {
  lender0: Address;
  lender1: Address;
  borrowerAPR0: number;
  borrowerAPR1: number;
  lender0Utilization: number;
  lender1Utilization: number;
  lender0TotalSupply: Big;
  lender1TotalSupply: Big;
  lender0TotalBorrows: Big;
  lender1TotalBorrows: Big;
};

export type LiquidationThresholds = {
  lower: number;
  upper: number;
};

/**
 * For the use-cases that may not require all of the data
 * (When we don't want to fetch more than we need)
 */
export type MarginAccountPreview = Omit<MarginAccount, 'sqrtPriceX96' | 'lender0' | 'lender1' | 'iv'>;

export async function getMarginAccountsForUser(
  chain: Chain,
  userAddress: string,
  provider: ethers.providers.Provider
): Promise<{ address: string; uniswapPool: string }[]> {
  const etherscanResult = await makeEtherscanRequest(
    0,
    ALOE_II_FACTORY_ADDRESS,
    [TOPIC0_CREATE_BORROWER_EVENT, null, `0x000000000000000000000000${userAddress.slice(2)}`],
    true,
    chain
  );
  if (!Array.isArray(etherscanResult.data.result)) return [];

  const accounts: { address: string; uniswapPool: string }[] = etherscanResult.data.result.map((item: any) => {
    return {
      address: item.data.slice(0, 2) + item.data.slice(26),
      uniswapPool: item.topics[1].slice(26),
    };
  });

  return accounts;
}

export type UniswapPoolInfo = {
  token0: Token;
  token1: Token;
  fee: number;
};

export async function fetchMarginAccountPreviews(
  chain: Chain,
  borrowerLensContract: ethers.Contract,
  provider: ethers.providers.BaseProvider,
  userAddress: string,
  uniswapPoolDataMap: Map<string, UniswapPoolInfo>
): Promise<MarginAccountPreview[]> {
  const marginAccountsAddresses = await getMarginAccountsForUser(chain, userAddress, provider);
  const marginAccounts: Promise<MarginAccountPreview | null>[] = marginAccountsAddresses.map(
    async ({ address: accountAddress, uniswapPool }) => {
      const uniswapPoolInfo = uniswapPoolDataMap.get(`0x${uniswapPool}`) ?? null;

      if (uniswapPoolInfo === null) return null;

      const token0 = uniswapPoolInfo.token0;
      const token1 = uniswapPoolInfo.token1;
      const feeTier = NumericFeeTierToEnum(uniswapPoolInfo.fee);

      if (!token0 || !token1) return null;

      let assetsData = null;
      let liabilitiesData = null;
      let healthData = null;

      try {
        assetsData = await borrowerLensContract.getAssets(accountAddress);
        liabilitiesData = await borrowerLensContract.getLiabilities(accountAddress, true);
        healthData = await borrowerLensContract.getHealth(accountAddress, true);
      } catch (e) {
        console.error(`borrowerLens.getAssets failed for account ${accountAddress} in pool ${uniswapPool}`, e);
        return null;
      }

      const health = healthData[0].lt(healthData[1]) ? healthData[0] : healthData[1];
      const assets: Assets = {
        token0Raw: Big(assetsData.fixed0.toString())
          .div(10 ** token0.decimals)
          .toNumber(),
        token1Raw: Big(assetsData.fixed1.toString())
          .div(10 ** token1.decimals)
          .toNumber(),
        uni0: Big(assetsData.fluid0C.toString())
          .div(10 ** token0.decimals)
          .toNumber(),
        uni1: Big(assetsData.fluid1C.toString())
          .div(10 ** token1.decimals)
          .toNumber(),
      };
      const liabilities: Liabilities = {
        amount0: Big(liabilitiesData.amount0.toString())
          .div(10 ** token0.decimals)
          .toNumber(),
        amount1: Big(liabilitiesData.amount1.toString())
          .div(10 ** token1.decimals)
          .toNumber(),
      };
      return {
        address: accountAddress,
        uniswapPool,
        token0,
        token1,
        feeTier,
        assets,
        liabilities,
        health: health.div(1e9).toNumber() / 1e9,
      };
    }
  );
  return (await Promise.all(marginAccounts)).filter((account) => account !== null) as MarginAccountPreview[];
}

export async function fetchMarketInfoFor(
  lenderLensContract: ethers.Contract,
  lender0: Address,
  lender1: Address
): Promise<MarketInfo> {
  const [lender0Basics, lender1Basics] = await Promise.all([
    lenderLensContract.readBasics(lender0),
    lenderLensContract.readBasics(lender1),
  ]);

  const interestRate0 = new Big(lender0Basics.interestRate.toString());
  const borrowAPR0 = interestRate0.eq('0') ? 0 : interestRate0.sub(1e12).div(1e12).toNumber() * secondsInYear;
  const interestRate1 = new Big(lender1Basics.interestRate.toString());
  const borrowAPR1 = interestRate1.eq('0') ? 0 : interestRate1.sub(1e12).div(1e12).toNumber() * secondsInYear;
  const lender0Utilization = new Big(lender0Basics.utilization.toString()).div(10 ** 18).toNumber();
  const lender1Utilization = new Big(lender1Basics.utilization.toString()).div(10 ** 18).toNumber();
  const lender0TotalSupply = new Big(lender0Basics.totalSupply.toString());
  const lender1TotalSupply = new Big(lender1Basics.totalSupply.toString());
  const lender0TotalBorrows = new Big(lender0Basics.totalBorrows.toString());
  const lender1TotalBorrows = new Big(lender1Basics.totalBorrows.toString());
  return {
    lender0,
    lender1,
    borrowerAPR0: borrowAPR0,
    borrowerAPR1: borrowAPR1,
    lender0Utilization: lender0Utilization,
    lender1Utilization: lender1Utilization,
    lender0TotalSupply: lender0TotalSupply,
    lender1TotalSupply: lender1TotalSupply,
    lender0TotalBorrows: lender0TotalBorrows,
    lender1TotalBorrows: lender1TotalBorrows,
  };
}

export async function fetchMarginAccount(
  accountAddress: string,
  chain: Chain,
  marginAccountContract: ethers.Contract,
  marginAccountLensContract: ethers.Contract,
  provider: ethers.providers.BaseProvider,
  marginAccountAddress: string
): Promise<{
  marginAccount: MarginAccount;
}> {
  const results = await Promise.all([
    marginAccountContract.TOKEN0(),
    marginAccountContract.TOKEN1(),
    marginAccountContract.LENDER0(),
    marginAccountContract.LENDER1(),
    marginAccountContract.UNISWAP_POOL(),
    marginAccountLensContract.getAssets(marginAccountAddress),
    marginAccountLensContract.getLiabilities(marginAccountAddress, true),
    marginAccountLensContract.getHealth(accountAddress, true),
  ]);

  const uniswapPool = results[4];
  const uniswapPoolContract = new ethers.Contract(uniswapPool, UniswapV3PoolABI, provider);
  const volatilityOracleContract = new ethers.Contract(ALOE_II_ORACLE, VolatilityOracleABI, provider);
  const token0 = getToken(chain.id, results[0] as Address);
  const token1 = getToken(chain.id, results[1] as Address);
  const lender0 = results[2] as Address;
  const lender1 = results[3] as Address;
  const assetsData = results[5];
  const liabilitiesData = results[6];
  const [feeTier, oracleResult] = await Promise.all([
    uniswapPoolContract.fee(),
    volatilityOracleContract.consult(uniswapPool),
  ]);

  const assets: Assets = {
    token0Raw: Big(assetsData.fixed0.toString())
      .div(10 ** token0.decimals)
      .toNumber(),
    token1Raw: Big(assetsData.fixed1.toString())
      .div(10 ** token1.decimals)
      .toNumber(),
    uni0: Big(assetsData.fluid0C.toString())
      .div(10 ** token0.decimals)
      .toNumber(),
    uni1: Big(assetsData.fluid1C.toString())
      .div(10 ** token1.decimals)
      .toNumber(),
  };
  const liabilities: Liabilities = {
    amount0: Big(liabilitiesData.amount0.toString())
      .div(10 ** token0.decimals)
      .toNumber(),
    amount1: Big(liabilitiesData.amount1.toString())
      .div(10 ** token1.decimals)
      .toNumber(),
  };

  const healthData = results[7];
  const health = healthData[0].lt(healthData[1]) ? healthData[0] : healthData[1];

  return {
    marginAccount: {
      address: marginAccountAddress,
      uniswapPool: uniswapPool,
      token0: token0,
      token1: token1,
      feeTier: NumericFeeTierToEnum(feeTier),
      assets: assets,
      liabilities: liabilities,
      sqrtPriceX96: toBig(oracleResult[0]),
      health: health.div(1e9).toNumber() / 1e9,
      lender0: lender0,
      lender1: lender1,
      iv: oracleResult[1].div(1e9).toNumber() / 1e9,
    },
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
  return new Big(price)
    .mul(10 ** (token1Decimals - token0Decimals))
    .sqrt()
    .mul(BIGQ96);
}

// function _computeProbePrices(sqrtMeanPriceX96: Big, sigma: number): [Big, Big] {
//   sigma = Math.min(Math.max(ALOE_II_SIGMA_MIN, sigma), ALOE_II_SIGMA_MAX);
//   sigma *= ALOE_II_SIGMA_SCALER;

//   let a = sqrtMeanPriceX96.mul(new Big((1 - sigma) * 1e18).sqrt()).div(1e9);
//   let b = sqrtMeanPriceX96.mul(new Big((1 + sigma) * 1e18).sqrt()).div(1e9);

//   // Constrain to be within TickMath's MIN_TICK and MAX_TICK
//   if (a.lt('4295128740')) {
//     a = new Big('4295128740');
//   }
//   if (b.gt('1461446703485210103287273052203988822378723970341')) {
//     b = new Big('1461446703485210103287273052203988822378723970341');
//   }
//   return [a, b];
// }

// export function getAssets(
//   marginAccount: MarginAccount,
//   uniswapPositions: readonly UniswapPosition[],
//   a: Big,
//   b: Big,
//   c: Big
// ) {
//   const tickA = TickMath.getTickAtSqrtRatio(JSBI.BigInt(a.toFixed(0)));
//   const tickB = TickMath.getTickAtSqrtRatio(JSBI.BigInt(b.toFixed(0)));
//   const tickC = TickMath.getTickAtSqrtRatio(JSBI.BigInt(c.toFixed(0)));

//   let fixed0 = marginAccount.assets.token0Raw;
//   let fixed1 = marginAccount.assets.token1Raw;

//   let fluid1A = 0;
//   let fluid1B = 0;
//   let fluid0C = 0;
//   let fluid1C = 0;

//   for (const position of uniswapPositions) {
//     const { liquidity, lower, upper } = position;
//     if (lower === null || upper === null) {
//       console.error('Attempted to compute liquidation thresholds for account with malformed Uniswap Position');
//       console.error(position);
//       continue;
//     }

//     fluid1A += getValueOfLiquidity(liquidity, lower, upper, tickA, marginAccount.token1.decimals);
//     fluid1B += getValueOfLiquidity(liquidity, lower, upper, tickB, marginAccount.token1.decimals);
//     const temp = getAmountsForLiquidity(
//       liquidity,
//       lower,
//       upper,
//       tickC,
//       marginAccount.token0.decimals,
//       marginAccount.token1.decimals
//     );
//     fluid0C += temp[0];
//     fluid1C += temp[1];
//   }

//   return {
//     fixed0,
//     fixed1,
//     fluid1A,
//     fluid1B,
//     fluid0C,
//     fluid1C,
//   };
// }

// function _computeLiquidationIncentive(
//   assets0: number,
//   assets1: number,
//   liabilities0: number,
//   liabilities1: number,
//   token0Decimals: number,
//   token1Decimals: number,
//   sqrtPriceX96: Big
// ): number {
//   const price = sqrtRatioToPrice(sqrtPriceX96, token0Decimals, token1Decimals);

//   let reward = 0;
//   if (liabilities0 > assets0) {
//     const shortfall = liabilities0 - assets0;
//     reward += (shortfall * price) / ALOE_II_LIQUIDATION_INCENTIVE;
//   }
//   if (liabilities1 > assets1) {
//     const shortfall = liabilities1 - assets1;
//     reward += shortfall / ALOE_II_LIQUIDATION_INCENTIVE;
//   }
//   return reward;
// }

// export function isSolvent(
//   marginAccount: MarginAccount,
//   uniswapPositions: readonly UniswapPosition[],
//   sqrtPriceX96: Big
// ) {
//   const token0Decimals = marginAccount.token0.decimals;
//   const token1Decimals = marginAccount.token1.decimals;

//   const [a, b] = _computeProbePrices(sqrtPriceX96, marginAccount.iv);
//   const priceA = sqrtRatioToPrice(a, token0Decimals, token1Decimals);
//   const priceB = sqrtRatioToPrice(b, token0Decimals, token1Decimals);

//   const mem = getAssets(marginAccount, uniswapPositions, a, b, sqrtPriceX96);
//   let liabilities0 = marginAccount.liabilities.amount0;
//   let liabilities1 = marginAccount.liabilities.amount1;

//   const liquidationIncentive = _computeLiquidationIncentive(
//     mem.fixed0 + mem.fluid0C,
//     mem.fixed1 + mem.fluid1C,
//     liabilities0,
//     liabilities1,
//     token0Decimals,
//     token1Decimals,
//     sqrtPriceX96
//   );

//   liabilities0 += liabilities0 / ALOE_II_MAX_LEVERAGE;
//   liabilities1 += liabilities1 / ALOE_II_MAX_LEVERAGE + liquidationIncentive;

//   const liabilitiesA = liabilities1 + liabilities0 * priceA;
//   const assetsA = mem.fluid1A + mem.fixed1 + mem.fixed0 * priceA;
//   const healthA = liabilitiesA > 0 ? assetsA / liabilitiesA : 1000;

//   const liabilitiesB = liabilities1 + liabilities0 * priceB;
//   const assetsB = mem.fluid1B + mem.fixed1 + mem.fixed0 * priceB;
//   const healthB = liabilitiesB > 0 ? assetsB / liabilitiesB : 1000;

//   return {
//     priceA,
//     priceB,
//     assetsA,
//     assetsB,
//     liabilitiesA,
//     liabilitiesB,
//     atA: assetsA >= liabilitiesA,
//     atB: assetsB >= liabilitiesB,
//     health: Math.min(healthA, healthB),
//   };
// }

// export function computeLiquidationThresholds(
//   marginAccount: MarginAccount,
//   uniswapPositions: UniswapPosition[],
//   iterations: number = 120,
//   precision: number = 7
// ): LiquidationThresholds {
//   let result: LiquidationThresholds = {
//     lower: 0,
//     upper: 0,
//   };

//   const MINPRICE = new Big(TickMath.MIN_SQRT_RATIO.toString(10)).mul(1.23);
//   const MAXPRICE = new Big(TickMath.MAX_SQRT_RATIO.toString()).div(1.23);

//   // Find lower liquidation threshold
//   const isSolventAtMin = isSolvent(marginAccount, uniswapPositions, MINPRICE);
//   if (isSolventAtMin.atA && isSolventAtMin.atB) {
//     // if solvent at beginning, short-circuit
//     result.lower = sqrtRatioToPrice(MINPRICE, marginAccount.token0.decimals, marginAccount.token1.decimals);
//   } else {
//     // Start binary search
//     let lowerBoundSqrtPrice = MINPRICE;
//     let upperBoundSqrtPrice = marginAccount.sqrtPriceX96;
//     let searchPrice: Big = new Big(0);
//     for (let i = 0; i < iterations; i++) {
//       const prevSearchPrice = searchPrice;
//       searchPrice = lowerBoundSqrtPrice.add(upperBoundSqrtPrice).div(2);
//       if (areWithinNSigDigs(searchPrice, prevSearchPrice, precision)) {
//         // binary search has converged
//         break;
//       }
//       const isSolventAtSearchPrice = isSolvent(marginAccount, uniswapPositions, searchPrice);
//       const isLiquidatableAtSearchPrice = !isSolventAtSearchPrice.atA || !isSolventAtSearchPrice.atB;
//       if (isLiquidatableAtSearchPrice) {
//         // liquidation threshold is lower
//         lowerBoundSqrtPrice = searchPrice;
//       } else {
//         // liquidation threshold is higher
//         upperBoundSqrtPrice = searchPrice;
//       }
//     }
//     result.lower = sqrtRatioToPrice(searchPrice, marginAccount.token0.decimals, marginAccount.token1.decimals);
//   }

//   // Find upper liquidation threshold
//   const isSolventAtMax = isSolvent(marginAccount, uniswapPositions, MAXPRICE);
//   if (isSolventAtMax.atA && isSolventAtMax.atB) {
//     // if solvent at end, short-circuit
//     result.upper = sqrtRatioToPrice(MAXPRICE, marginAccount.token0.decimals, marginAccount.token1.decimals);
//   } else {
//     // Start binary search
//     let lowerBoundSqrtPrice = marginAccount.sqrtPriceX96;
//     let upperBoundSqrtPrice = MAXPRICE;
//     let searchPrice: Big = new Big(0);
//     for (let i = 0; i < iterations; i++) {
//       const prevSearchPrice = searchPrice;
//       searchPrice = lowerBoundSqrtPrice.add(upperBoundSqrtPrice).div(2);
//       if (areWithinNSigDigs(searchPrice, prevSearchPrice, precision)) {
//         // binary search has converged
//         break;
//       }
//       const isSolventAtSearchPrice = isSolvent(marginAccount, uniswapPositions, searchPrice);
//       const isLiquidatableAtSearchPrice = !isSolventAtSearchPrice.atA || !isSolventAtSearchPrice.atB;
//       if (isLiquidatableAtSearchPrice) {
//         // liquidation threshold is higher
//         upperBoundSqrtPrice = searchPrice;
//       } else {
//         // liquidation threshold is lower
//         lowerBoundSqrtPrice = searchPrice;
//       }
//     }
//     result.upper = sqrtRatioToPrice(searchPrice, marginAccount.token0.decimals, marginAccount.token1.decimals);
//   }

//   return result;
// }

export function sumAssetsPerToken(assets: Assets): [number, number] {
  return [assets.token0Raw + assets.uni0, assets.token1Raw + assets.uni1];
}
