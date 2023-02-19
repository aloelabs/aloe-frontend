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
import { ALOE_II_FACTORY_ADDRESS, ALOE_II_ORACLE } from './constants/Addresses';
import { TOPIC0_CREATE_BORROWER_EVENT } from './constants/Signatures';
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
