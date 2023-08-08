import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { ethers } from 'ethers';
import { base } from 'shared/lib/data/BaseChain';
import {
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_LENDER_LENS_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
  MULTICALL_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import { getToken } from 'shared/lib/data/TokenData';
import { toImpreciseNumber } from 'shared/lib/util/Numbers';
import { Address, Chain } from 'wagmi';

import ERC20ABI from '../assets/abis/ERC20.json';
import KittyABI from '../assets/abis/Kitty.json';
import KittyLensABI from '../assets/abis/KittyLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import VolatilityOracleABI from '../assets/abis/VolatilityOracle.json';
import { ContractCallReturnContextEntries, convertBigNumbersForReturnContexts } from '../util/Multicall';
import { UNISWAP_POOL_DENYLIST } from './constants/Addresses';

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
  const multicall = new Multicall({
    ethersProvider: provider,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chain.id],
  });
  let logs: ethers.providers.Log[] = [];
  try {
    logs = await provider.getLogs({
      fromBlock: chain.id === base.id ? 2284814 : 0,
      toBlock: 'latest',
      address: ALOE_II_FACTORY_ADDRESS[chain.id],
      topics: ['0x3f53d2c2743b2b162c0aa5d678be4058d3ae2043700424be52c04105df3e2411'],
    });
  } catch (e) {
    console.error(e);
  }
  if (logs.length === 0) return [];

  const addresses: { pool: string; kitty0: string; kitty1: string }[] = logs.map((item: any) => {
    return {
      pool: item.topics[1].slice(26),
      kitty0: `0x${item.data.slice(26, 66)}`,
      kitty1: `0x${item.data.slice(90, 134)}`,
    };
  });

  const contractCallContexts: ContractCallContext[] = [];

  addresses.forEach((market) => {
    if (UNISWAP_POOL_DENYLIST.includes(`0x${market.pool.toLowerCase()}`)) {
      return;
    }

    contractCallContexts.push({
      reference: `${market.pool}-basics`,
      contractAddress: ALOE_II_LENDER_LENS_ADDRESS[chain.id],
      abi: KittyLensABI,
      calls: [
        {
          reference: `${market.pool}-basics0`,
          methodName: 'readBasics',
          methodParameters: [market.kitty0],
        },
        {
          reference: `${market.pool}-basics1`,
          methodName: 'readBasics',
          methodParameters: [market.kitty1],
        },
      ],
      context: { kitty0Address: market.kitty0, kitty1Address: market.kitty1 },
    });

    contractCallContexts.push({
      reference: `${market.pool}-feeTier`,
      contractAddress: market.pool,
      abi: UniswapV3PoolABI,
      calls: [
        {
          reference: `${market.pool}-feeTier`,
          methodName: 'fee',
          methodParameters: [],
        },
      ],
    });

    contractCallContexts.push({
      reference: `${market.pool}-oracle`,
      contractAddress: ALOE_II_ORACLE_ADDRESS[chain.id],
      abi: VolatilityOracleABI,
      calls: [
        {
          reference: `${market.pool}-oracle`,
          methodName: 'consult',
          methodParameters: [market.pool],
        },
      ],
    });
  });

  const lendingPairResults = (await multicall.call(contractCallContexts)).results;

  const correspondingLendingPairResults: Map<string, ContractCallReturnContextEntries> = new Map();
  // Convert the results into a map of account address to the results
  Object.entries(lendingPairResults).forEach(([key, value]) => {
    const entryAccountAddress = key.split('-')[0];
    const entryType = key.split('-')[1];
    const existingValue = correspondingLendingPairResults.get(entryAccountAddress);
    if (existingValue) {
      existingValue[entryType] = value;
      correspondingLendingPairResults.set(entryAccountAddress, existingValue);
    } else {
      correspondingLendingPairResults.set(entryAccountAddress, { [entryType]: value });
    }
  });

  const lendingPairs: LendingPair[] = [];

  correspondingLendingPairResults.forEach((value) => {
    const { basics: basicsResults, feeTier: feeTierResults, oracle: oracleResults } = value;
    const basicsReturnContexts = convertBigNumbersForReturnContexts(basicsResults.callsReturnContext);
    const feeTierReturnContexts = convertBigNumbersForReturnContexts(feeTierResults.callsReturnContext);
    const oracleReturnContexts = convertBigNumbersForReturnContexts(oracleResults.callsReturnContext);
    const { kitty0Address, kitty1Address } = basicsResults.originalContractCallContext.context;

    const basics0 = basicsReturnContexts[0].returnValues;
    const basics1 = basicsReturnContexts[1].returnValues;
    const feeTier = feeTierReturnContexts[0].returnValues;
    const oracleResult = oracleReturnContexts[0].returnValues;
    const token0 = getToken(chain.id, basics0[0]);
    const token1 = getToken(chain.id, basics1[0]);
    if (token0 == null || token1 == null) return;
    const kitty0 = new Kitty(
      chain.id,
      kitty0Address as Address,
      token0.decimals,
      `${token0.symbol}+`,
      `Aloe II ${token0.name}`,
      token0.logoURI,
      token0
    );
    const kitty1 = new Kitty(
      chain.id,
      kitty1Address as Address,
      token1.decimals,
      `${token1.symbol}+`,
      `Aloe II ${token1.name}`,
      token1.logoURI,
      token1
    );

    const interestRate0 = toImpreciseNumber(basics0[1], 12);
    const interestRate1 = toImpreciseNumber(basics1[1], 12);

    const utilization0 = toImpreciseNumber(basics0[2], 18);
    const utilization1 = toImpreciseNumber(basics1[2], 18);

    const inventory0 = toImpreciseNumber(basics0[3], token0.decimals);
    const inventory1 = toImpreciseNumber(basics1[3], token1.decimals);

    const totalSupply0 = toImpreciseNumber(basics0[5], kitty0.decimals);
    const totalSupply1 = toImpreciseNumber(basics1[5], kitty1.decimals);

    // SupplyAPR = Utilization * (1 - reservePercentage) * BorrowAPR
    const APR0 = utilization0 * (1 - 1 / 8) * (interestRate0 - 1.0);
    const APR1 = utilization1 * (1 - 1 / 8) * (interestRate1 - 1.0);
    const APY0 = (1 + APR0) ** (365 * 24 * 60 * 60) - 1.0;
    const APY1 = (1 + APR1) ** (365 * 24 * 60 * 60) - 1.0;

    let IV = oracleResult[1].div(1e9).toNumber() / 1e9;
    // Annualize it
    IV *= Math.sqrt(365);

    lendingPairs.push(
      new LendingPair(
        token0,
        token1,
        kitty0,
        kitty1,
        {
          apy: APY0 * 100, // Percentage
          inventory: inventory0,
          totalSupply: totalSupply0,
          utilization: utilization0 * 100.0, // Percentage
        },
        {
          apy: APY1 * 100, // Percentage
          inventory: inventory1,
          totalSupply: totalSupply1,
          utilization: utilization1 * 100.0, // Percentage
        },
        NumericFeeTierToEnum(feeTier[0]),
        IV * 100
      )
    );
  });

  return lendingPairs;
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
  const token0Balance = toImpreciseNumber(token0BalanceBig, token0.decimals);
  const token1Balance = toImpreciseNumber(token1BalanceBig, token1.decimals);
  const kitty0Balance = toImpreciseNumber(kitty0BalanceBig, token0.decimals);
  const kitty1Balance = toImpreciseNumber(kitty1BalanceBig, token1.decimals);
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

export function sortLendingPairsByAPY(lendingPairs: LendingPair[]): LendingPair[] {
  return lendingPairs.sort((a, b) => {
    const apyA = a.kitty0Info.apy + a.kitty1Info.apy;
    const apyB = b.kitty0Info.apy + b.kitty1Info.apy;
    return apyB - apyA;
  });
}
