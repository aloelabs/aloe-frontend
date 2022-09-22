import { ethers } from 'ethers';
import { makeEtherscanRequest } from '../util/Etherscan';
import { FeeTier, NumericFeeTierToEnum } from './FeeTier';
import { GetTokenData, TokenData } from './TokenData';
import KittyABI from '../assets/abis/Kitty.json';
import KittyLensABI from '../assets/abis/KittyLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import Big from 'big.js';
import { ALOE_II_FACTORY_ADDRESS_GOERLI, ALOE_II_KITTY_LENS_ADDRESS } from './constants/Addresses';

export type LendingPair = {
  token0: TokenData;
  token1: TokenData;
  kitty0: TokenData;
  kitty1: TokenData;
  token0APY: number;
  token1APY: number;
  // token0Inventory: Big;
  // token1Inventory: Big;
  token0TotalSupply: number;
  token1TotalSupply: number;
  token0Utilization: number;
  token1Utilization: number;
  uniswapFeeTier: FeeTier;
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

  const addresses: {pool: string, kitty0: string, kitty1: string}[] = etherscanResult.data.result.map((item: any) => {
    return {
      pool: item.topics[1].slice(26),
      kitty0: `0x${item.topics[2].slice(26)}`,
      kitty1: `0x${item.topics[3].slice(26)}`,
    };
  });

  const kittyLens = new ethers.Contract(ALOE_II_KITTY_LENS_ADDRESS, KittyLensABI, provider);

  return await Promise.all(addresses.map(async (market) => {
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
    const APY0 = (interestRate0.div(10 ** 18).plus(1.0).toNumber() ** (365 * 24 * 60 * 60)) - 1.0;
    const APY1 = (interestRate1.div(10 ** 18).plus(1.0).toNumber() ** (365 * 24 * 60 * 60)) - 1.0;
    // inventory != totalSupply due to interest rates (inflation)
    return {
      token0,
      token1,
      kitty0,
      kitty1,
      token0APY: APY0,
      token1APY: APY1,
      // inventory is the total amount of raw token that has been deposited (or deposited - withdrawn technically)
      // token0Inventory: result0.inventory,
      // token1Inventory: result1.inventory,
      // totalSupply is the total amount of plus tokens in existance
      token0TotalSupply: new Big(result0.inventory.toString()).div(10 ** token0.decimals).toNumber(),
      token1TotalSupply: new Big(result1.inventory.toString()).div(10 ** token1.decimals).toNumber(),
      token0Utilization: new Big(result0.utilization.toString()).div(10 ** 18).toNumber(),
      token1Utilization: new Big(result1.utilization.toString()).div(10 ** 18).toNumber(),
      uniswapFeeTier: NumericFeeTierToEnum(result2),
    };
  }));
}
