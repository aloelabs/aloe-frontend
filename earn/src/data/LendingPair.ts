import Big from 'big.js';
import { ethers } from 'ethers';

import ERC20ABI from '../assets/abis/ERC20.json';
import KittyABI from '../assets/abis/Kitty.json';
import KittyLensABI from '../assets/abis/KittyLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { makeEtherscanRequest } from '../util/Etherscan';
import { ALOE_II_FACTORY_ADDRESS_GOERLI, ALOE_II_KITTY_LENS_ADDRESS } from './constants/Addresses';
import { FeeTier, NumericFeeTierToEnum } from './FeeTier';
import { GetTokenData, TokenData } from './TokenData';

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

export type LendingPair = {
  token0: TokenData;
  token1: TokenData;
  kitty0: TokenData;
  kitty1: TokenData;
  kitty0Info: KittyInfo;
  kitty1Info: KittyInfo;
  uniswapFeeTier: FeeTier;
};

export type LendingPairBalances = {
  token0Balance: number;
  token1Balance: number;
  kitty0Balance: number;
  kitty1Balance: number;
};

export async function getAvailableLendingPairs(provider: ethers.providers.BaseProvider): Promise<LendingPair[]> {
  const etherscanResult = await makeEtherscanRequest(
    7537163,
    ALOE_II_FACTORY_ADDRESS_GOERLI,
    ['0x3f53d2c2743b2b162c0aa5d678be4058d3ae2043700424be52c04105df3e2411'],
    true,
    'api-goerli'
  );
  if (!Array.isArray(etherscanResult.data.result)) return [];

  const addresses: { pool: string; kitty0: string; kitty1: string }[] = etherscanResult.data.result.map((item: any) => {
    return {
      pool: item.topics[1].slice(26),
      kitty0: `0x${item.topics[2].slice(26)}`,
      kitty1: `0x${item.topics[3].slice(26)}`,
    };
  });

  const kittyLens = new ethers.Contract(ALOE_II_KITTY_LENS_ADDRESS, KittyLensABI, provider);

  return Promise.all(
    addresses.map(async (market) => {
      const uniswapPool = new ethers.Contract(market.pool, UniswapV3PoolABI, provider);

      const [result0, result1, result2] = await Promise.all([
        kittyLens.readBasics(market.kitty0),
        kittyLens.readBasics(market.kitty1),
        uniswapPool.fee(),
      ]);

      const token0 = GetTokenData(result0.asset);
      const token1 = GetTokenData(result1.asset);
      const kitty0 = GetTokenData(market.kitty0);
      const kitty1 = GetTokenData(market.kitty1);

      const interestRate0 = new Big(result0.interestRate.toString());
      const interestRate1 = new Big(result1.interestRate.toString());
      const APY0 =
        interestRate0
          .div(10 ** 18)
          .plus(1.0)
          .toNumber() **
          (365 * 24 * 60 * 60) -
        1.0;
      const APY1 =
        interestRate1
          .div(10 ** 18)
          .plus(1.0)
          .toNumber() **
          (365 * 24 * 60 * 60) -
        1.0;
      // inventory != totalSupply due to interest rates (inflation)
      return {
        token0,
        token1,
        kitty0,
        kitty1,
        kitty0Info: {
          apy: APY0 * 100, // percentage
          inventory: new Big(result0.inventory.toString()).div(10 ** token0.decimals).toNumber(),
          totalSupply: new Big(result0.totalSupply.toString()).div(10 ** kitty0.decimals).toNumber(),
          utilization: new Big(result0.utilization.toString()).div(10 ** 18).toNumber() * 100.0, // Percentage
        },
        kitty1Info: {
          apy: APY1 * 100, // percentage
          inventory: new Big(result1.inventory.toString()).div(10 ** token1.decimals).toNumber(),
          totalSupply: new Big(result1.totalSupply.toString()).div(10 ** kitty1.decimals).toNumber(),
          utilization: new Big(result1.utilization.toString()).div(10 ** 18).toNumber() * 100.0, // Percentage
        },
        uniswapFeeTier: NumericFeeTierToEnum(result2),
      };
    })
  );
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
    kitty0Contract.balanceOfUnderlying(userAddress),
    kitty1Contract.balanceOfUnderlying(userAddress),
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
