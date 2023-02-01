import { AxiosResponse } from 'axios';
import Big from 'big.js';
import { ethers } from 'ethers';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { Address, Chain } from 'wagmi';

import ERC20ABI from '../assets/abis/ERC20.json';
import KittyABI from '../assets/abis/Kitty.json';
import KittyLensABI from '../assets/abis/KittyLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import VolatilityOracleABI from '../assets/abis/VolatilityOracle.json';
import { makeEtherscanRequest } from '../util/Etherscan';
import { ALOE_II_FACTORY_ADDRESS, ALOE_II_KITTY_LENS_ADDRESS, ALOE_II_ORACLE } from './constants/Addresses';
import { Kitty } from './Kitty';
import { Token } from './Token';
import { getToken } from './TokenData';

export interface KittyInfo {
  // The current APY being earned by Kitty token holders
  apy: number;
  // The amount of underlying owed to all Kitty token holders
  // (both the amount currently sitting in contract, and the amount that has been lent out)
  inventory: number;
  // The total number of outstanding Kitty tokens
  totalSupply: number;
  // What percentage of inventory that has been lent out to borrowers
  utilization: number;
}

export class LendingPair {
  constructor(
    public token0: Token,
    public token1: Token,
    public kitty0: Kitty,
    public kitty1: Kitty,
    public kitty0Info: KittyInfo,
    public kitty1Info: KittyInfo,
    public uniswapFeeTier: FeeTier,
    public iv: number
  ) {}

  equals(other: LendingPair) {
    return other.kitty0.address === this.kitty0.address && other.kitty1.address === this.kitty1.address;
  }
}

export type LendingPairBalances = {
  token0Balance: number;
  token1Balance: number;
  kitty0Balance: number;
  kitty1Balance: number;
};

export async function getAvailableLendingPairs(
  chain: Chain,
  provider: ethers.providers.BaseProvider
): Promise<LendingPair[]> {
  let etherscanResult: AxiosResponse<any, any> | null = null;
  try {
    etherscanResult = await makeEtherscanRequest(
      7537163,
      ALOE_II_FACTORY_ADDRESS,
      ['0x3f53d2c2743b2b162c0aa5d678be4058d3ae2043700424be52c04105df3e2411'],
      true,
      chain
    );
  } catch (e) {
    console.error(e);
  }
  if (etherscanResult == null || !Array.isArray(etherscanResult.data.result)) return [];

  const addresses: { pool: string; kitty0: string; kitty1: string }[] = etherscanResult.data.result.map((item: any) => {
    return {
      pool: item.topics[1].slice(26),
      kitty0: `0x${item.data.slice(26, 66)}`,
      kitty1: `0x${item.data.slice(90, 134)}`,
    };
  });

  const kittyLens = new ethers.Contract(ALOE_II_KITTY_LENS_ADDRESS, KittyLensABI, provider);
  const oracle = new ethers.Contract(ALOE_II_ORACLE, VolatilityOracleABI, provider);

  const unfilteredPairs: Array<LendingPair | null> = await Promise.all(
    addresses.map(async (market) => {
      const uniswapPool = new ethers.Contract(market.pool, UniswapV3PoolABI, provider);

      const [basics0, basics1, feeTier, oracleResult] = await Promise.all([
        kittyLens.readBasics(market.kitty0),
        kittyLens.readBasics(market.kitty1),
        uniswapPool.fee(),
        oracle.consult(market.pool),
      ]);

      const token0 = getToken(chain.id, basics0.asset);
      const token1 = getToken(chain.id, basics1.asset);
      if (token0 == null || token1 == null) return null;
      const kitty0 = new Kitty(
        chain.id,
        market.kitty0 as Address,
        token0.decimals,
        `${token0.ticker}+`,
        `Aloe II ${token0.name}`,
        token0.iconPath,
        token0
      );
      const kitty1 = new Kitty(
        chain.id,
        market.kitty1 as Address,
        token1.decimals,
        `${token1.ticker}+`,
        `Aloe II ${token1.name}`,
        token1.iconPath,
        token1
      );

      const utilization0 = new Big(basics0.utilization.toString()).div(10 ** 18).toNumber();
      const utilization1 = new Big(basics1.utilization.toString()).div(10 ** 18).toNumber();

      const interestRate0 = new Big(basics0.interestRate.toString());
      const interestRate1 = new Big(basics1.interestRate.toString());
      // SupplyAPY = Utilization * (1 - reservePercentage) * BorrowAPY
      const APY0 = utilization0 * (1 - 1 / 8) * (interestRate0.div(10 ** 12).toNumber() ** (365 * 24 * 60 * 60) - 1.0);
      const APY1 = utilization1 * (1 - 1 / 8) * (interestRate1.div(10 ** 12).toNumber() ** (365 * 24 * 60 * 60) - 1.0);

      let IV = oracleResult[1].div(1e9).toNumber() / 1e9;
      // Annualize it
      IV *= Math.sqrt(365);

      return new LendingPair(
        token0,
        token1,
        kitty0,
        kitty1,
        {
          apy: APY0 * 100, // percentage
          inventory: new Big(basics0.inventory.toString()).div(10 ** token0.decimals).toNumber(),
          totalSupply: new Big(basics0.totalSupply.toString()).div(10 ** kitty0.decimals).toNumber(),
          utilization: utilization0 * 100.0, // Percentage
        },
        {
          apy: APY1 * 100, // percentage
          inventory: new Big(basics1.inventory.toString()).div(10 ** token1.decimals).toNumber(),
          totalSupply: new Big(basics1.totalSupply.toString()).div(10 ** kitty1.decimals).toNumber(),
          utilization: utilization1 * 100.0, // Percentage
        },
        NumericFeeTierToEnum(feeTier),
        IV * 100
      );
    })
  );
  const filteredPairs = unfilteredPairs.filter((pair) => pair != null) as LendingPair[];
  return filteredPairs;
}

export async function getLendingPairBalances(
  lendingPair: LendingPair,
  userAddress: string,
  provider: ethers.providers.Provider
): Promise<LendingPairBalances> {
  const { token0, token1, kitty0, kitty1 } = lendingPair;

  const token0Contract = new ethers.Contract(token0.address, ERC20ABI, provider);
  const token1Contract = new ethers.Contract(token1.address, ERC20ABI, provider);
  const kitty0Contract = new ethers.Contract(kitty0.address, KittyABI, provider);
  const kitty1Contract = new ethers.Contract(kitty1.address, KittyABI, provider);
  const [token0BalanceBig, token1BalanceBig, kitty0BalanceBig, kitty1BalanceBig] = await Promise.all([
    token0Contract.balanceOf(userAddress),
    token1Contract.balanceOf(userAddress),
    kitty0Contract.underlyingBalance(userAddress),
    kitty1Contract.underlyingBalance(userAddress),
  ]);
  const token0Balance = new Big(token0BalanceBig.toString()).div(10 ** token0.decimals).toNumber();
  const token1Balance = new Big(token1BalanceBig.toString()).div(10 ** token1.decimals).toNumber();
  const kitty0Balance = new Big(kitty0BalanceBig.toString()).div(10 ** token0.decimals).toNumber();
  const kitty1Balance = new Big(kitty1BalanceBig.toString()).div(10 ** token1.decimals).toNumber();
  return {
    token0Balance,
    token1Balance,
    kitty0Balance,
    kitty1Balance,
  };
}

/**
 * Filter lending pairs by tokens
 * @param lendingPairs Lending pairs
 * @param tokens Tokens
 * @returns Filtered lending pairs that contain at least one of the tokens
 */

export function filterLendingPairsByTokens(lendingPairs: LendingPair[], tokens: Token[]): LendingPair[] {
  return lendingPairs.filter((pair) => {
    return tokens.some((token) => token.address === pair.token0.address || token.address === pair.token1.address);
  });
}
