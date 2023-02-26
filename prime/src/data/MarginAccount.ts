import Big from 'big.js';
import { ethers } from 'ethers';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { Address, Chain } from 'wagmi';

import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import VolatilityOracleABI from '../assets/abis/VolatilityOracle.json';
import { makeEtherscanRequest } from '../util/Etherscan';
import { toBig, toImpreciseNumber } from '../util/Numbers';
import { ALOE_II_FACTORY_ADDRESS, ALOE_II_ORACLE } from './constants/Addresses';
import { TOPIC0_CREATE_BORROWER_EVENT } from './constants/Signatures';
import { Token } from './Token';
import { getToken } from './TokenData';

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

export type UniswapPoolInfo = {
  token0: Address;
  token1: Address;
  fee: number;
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

      const token0 = getToken(chain.id, uniswapPoolInfo.token0);
      const token1 = getToken(chain.id, uniswapPoolInfo.token1);
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

      const health = toImpreciseNumber(healthData[0].lt(healthData[1]) ? healthData[0] : healthData[1], 18);
      const assets: Assets = {
        token0Raw: toImpreciseNumber(assetsData.fixed0, token0.decimals),
        token1Raw: toImpreciseNumber(assetsData.fixed1, token1.decimals),
        uni0: toImpreciseNumber(assetsData.fluid0C, token0.decimals),
        uni1: toImpreciseNumber(assetsData.fluid1C, token1.decimals),
      };
      const liabilities: Liabilities = {
        amount0: toImpreciseNumber(liabilitiesData.amount0, token0.decimals),
        amount1: toImpreciseNumber(liabilitiesData.amount1, token1.decimals),
      };
      return {
        address: accountAddress,
        uniswapPool,
        token0,
        token1,
        feeTier,
        assets,
        liabilities,
        health: health,
      };
    }
  );
  return (await Promise.all(marginAccounts)).filter((account) => account !== null) as MarginAccountPreview[];
}

export async function fetchMarginAccount(
  accountAddress: string,
  chain: Chain,
  lenderLensContract: ethers.Contract,
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
    token0Raw: toImpreciseNumber(assetsData.fixed0, token0.decimals),
    token1Raw: toImpreciseNumber(assetsData.fixed1, token1.decimals),
    uni0: toImpreciseNumber(assetsData.fluid0C, token0.decimals),
    uni1: toImpreciseNumber(assetsData.fluid1C, token1.decimals),
  };
  const liabilities: Liabilities = {
    amount0: toImpreciseNumber(liabilitiesData.amount0, token0.decimals),
    amount1: toImpreciseNumber(liabilitiesData.amount1, token1.decimals),
  };

  const healthData = results[7];
  const health = toImpreciseNumber(healthData[0].lt(healthData[1]) ? healthData[0] : healthData[1], 18);
  const iv = toImpreciseNumber(oracleResult[1], 18);

  return {
    marginAccount: {
      address: marginAccountAddress,
      feeTier: NumericFeeTierToEnum(feeTier),
      sqrtPriceX96: toBig(oracleResult[0]),
      uniswapPool,
      token0,
      token1,
      assets,
      liabilities,
      health,
      lender0,
      lender1,
      iv,
    },
  };
}
