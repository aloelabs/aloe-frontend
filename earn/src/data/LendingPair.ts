import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { BigNumber, ethers } from 'ethers';
import JSBI from 'jsbi';
import { erc20Abi } from 'shared/lib/abis/ERC20';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { lenderAbi } from 'shared/lib/abis/Lender';
import { lenderLensAbi } from 'shared/lib/abis/LenderLens';
import { uniswapV3PoolAbi } from 'shared/lib/abis/UniswapV3Pool';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import {
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_LENDER_LENS_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
  MULTICALL_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { Q32 } from 'shared/lib/data/constants/Values';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { GN } from 'shared/lib/data/GoodNumber';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import { getToken } from 'shared/lib/data/TokenData';
import { toImpreciseNumber } from 'shared/lib/util/Numbers';
import { Address } from 'wagmi';

import { ContractCallReturnContextEntries, convertBigNumbersForReturnContexts } from '../util/Multicall';
import { computeLTV } from './BalanceSheet';
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
    public uniswapPool: Address,
    public uniswapFeeTier: FeeTier,
    public iv: number,
    public nSigma: number,
    public ltv: number,
    public rewardsRate0: number,
    public rewardsRate1: number
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

export type LendingPairBalancesMap = Map<Address, { value: number; gn: GN; form: 'raw' | 'underlying' }>;

export async function getAvailableLendingPairs(
  chainId: number,
  provider: ethers.providers.BaseProvider
): Promise<LendingPair[]> {
  const multicall = new Multicall({
    ethersProvider: provider,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chainId],
  });
  let logs: ethers.providers.Log[] = [];
  try {
    logs = await provider.getLogs({
      fromBlock: 0,
      toBlock: 'latest',
      address: ALOE_II_FACTORY_ADDRESS[chainId],
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
      contractAddress: ALOE_II_LENDER_LENS_ADDRESS[chainId],
      abi: lenderLensAbi as any,
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
      abi: uniswapV3PoolAbi as any,
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
      contractAddress: ALOE_II_ORACLE_ADDRESS[chainId],
      abi: volatilityOracleAbi as any,
      calls: [
        {
          reference: `${market.pool}-oracle`,
          methodName: 'consult',
          methodParameters: [market.pool, Q32],
        },
      ],
    });

    contractCallContexts.push({
      reference: `${market.pool}-factory`,
      contractAddress: ALOE_II_FACTORY_ADDRESS[chainId],
      abi: factoryAbi as any,
      calls: [
        {
          reference: `${market.pool}-factory`,
          methodName: 'getParameters',
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

  Array.from(correspondingLendingPairResults.entries()).forEach(([uniswapPool, value]) => {
    const { basics: basicsResults, feeTier: feeTierResults, oracle: oracleResults, factory: factoryResults } = value;
    const basicsReturnContexts = convertBigNumbersForReturnContexts(basicsResults.callsReturnContext);
    const feeTierReturnContexts = convertBigNumbersForReturnContexts(feeTierResults.callsReturnContext);
    const oracleReturnContexts = convertBigNumbersForReturnContexts(oracleResults.callsReturnContext);
    const factoryReturnContexts = convertBigNumbersForReturnContexts(factoryResults.callsReturnContext);
    const { kitty0Address, kitty1Address } = basicsResults.originalContractCallContext.context;

    const basics0 = basicsReturnContexts[0].returnValues;
    const basics1 = basicsReturnContexts[1].returnValues;
    const feeTier = feeTierReturnContexts[0].returnValues;
    const oracleResult = oracleReturnContexts[0].returnValues;
    const factoryResult = factoryReturnContexts[0].returnValues;
    const token0 = getToken(chainId, basics0[0]);
    const token1 = getToken(chainId, basics1[0]);
    if (token0 == null || token1 == null) return;
    const kitty0 = new Kitty(
      chainId,
      kitty0Address as Address,
      token0.decimals,
      `${token0.symbol}+`,
      `Aloe II ${token0.name}`,
      token0.logoURI,
      token0
    );
    const kitty1 = new Kitty(
      chainId,
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

    const reserveFactor0 = basics0[6];
    const reserveFactor1 = basics1[6];

    const rewardsRate0 = toImpreciseNumber(basics0[7], 18);
    const rewardsRate1 = toImpreciseNumber(basics1[7], 18);

    // SupplyAPR = Utilization * (1 - reservePercentage) * BorrowAPR
    const APR0 = utilization0 * (1 - 1 / reserveFactor0) * interestRate0;
    const APR1 = utilization1 * (1 - 1 / reserveFactor1) * interestRate1;
    const APY0 = (1 + APR0) ** (365 * 24 * 60 * 60) - 1.0;
    const APY1 = (1 + APR1) ** (365 * 24 * 60 * 60) - 1.0;

    const iv = ethers.BigNumber.from(oracleResult[2]).div(1e6).toNumber() / 1e6;

    const nSigma = (factoryResult[1] as number) / 10;

    const ltv = computeLTV(iv, nSigma);

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
        uniswapPool as Address,
        NumericFeeTierToEnum(feeTier[0]),
        iv * Math.sqrt(365),
        nSigma,
        ltv,
        rewardsRate0,
        rewardsRate1
      )
    );
  });

  return lendingPairs;
}

export async function getLendingPairBalances(
  lendingPairs: LendingPair[],
  userAddress: string,
  provider: ethers.providers.Provider,
  chainId: number
) {
  const tokenSet = new Set<Token>();
  lendingPairs.forEach((pair) => {
    tokenSet.add(pair.token0);
    tokenSet.add(pair.token1);
  });

  const multicall = new Multicall({
    ethersProvider: provider,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chainId],
  });
  const contractCallContexts: ContractCallContext[] = [];

  tokenSet.forEach((token) =>
    contractCallContexts.push({
      reference: `${token.address}.balanceOf`,
      contractAddress: token.address,
      abi: erc20Abi as any,
      calls: [{ reference: 'balanceOf', methodName: 'balanceOf', methodParameters: [userAddress] }],
    })
  );

  lendingPairs.forEach((lendingPair) =>
    contractCallContexts.push(
      {
        reference: `${lendingPair.kitty0.address}.underlyingBalance`,
        contractAddress: lendingPair.kitty0.address,
        abi: lenderAbi as any,
        calls: [
          {
            reference: 'underlyingBalance',
            methodName: 'underlyingBalance',
            methodParameters: [userAddress],
          },
        ],
      },
      {
        reference: `${lendingPair.kitty1.address}.underlyingBalance`,
        contractAddress: lendingPair.kitty1.address,
        abi: lenderAbi as any,
        calls: [
          {
            reference: 'underlyingBalance',
            methodName: 'underlyingBalance',
            methodParameters: [userAddress],
          },
        ],
      }
    )
  );

  const results = (await multicall.call(contractCallContexts)).results;

  const deprecatedLendingPairBalancesArray: LendingPairBalances[] = [];
  const balancesMap: LendingPairBalancesMap = new Map();

  lendingPairs.forEach((lendingPair) => {
    const hexes = [
      `${lendingPair.token0.address}.balanceOf`,
      `${lendingPair.token1.address}.balanceOf`,
      `${lendingPair.kitty0.address}.underlyingBalance`,
      `${lendingPair.kitty1.address}.underlyingBalance`,
    ].map((key) => results[key].callsReturnContext[0].returnValues[0].hex);

    const gns = hexes.map((hex, i) =>
      GN.fromJSBI(JSBI.BigInt(hex), lendingPair[i % 2 ? 'token1' : 'token0'].decimals, 10)
    );

    // NOTE: If `token0` or `token1` exists in multiple lending pairs, we'll be setting the same value
    // in the map over and over. This doesn't hurt anything, and as long as we need to generate the old
    // array-style return value, doing it here is simpler than iterating over the `tokenSet` so as to
    // set the values only once.
    balancesMap.set(lendingPair.token0.address, { value: gns[0].toNumber(), gn: gns[0], form: 'raw' });
    balancesMap.set(lendingPair.token1.address, { value: gns[1].toNumber(), gn: gns[1], form: 'raw' });
    balancesMap.set(lendingPair.kitty0.address, { value: gns[2].toNumber(), gn: gns[2], form: 'underlying' });
    balancesMap.set(lendingPair.kitty1.address, { value: gns[3].toNumber(), gn: gns[3], form: 'underlying' });

    deprecatedLendingPairBalancesArray.push({
      token0Balance: toImpreciseNumber(BigNumber.from(hexes[0]), lendingPair.token0.decimals),
      token1Balance: toImpreciseNumber(BigNumber.from(hexes[1]), lendingPair.token1.decimals),
      kitty0Balance: toImpreciseNumber(BigNumber.from(hexes[2]), lendingPair.token0.decimals),
      kitty1Balance: toImpreciseNumber(BigNumber.from(hexes[3]), lendingPair.token1.decimals),
    });
  });

  return {
    lendingPairBalances: deprecatedLendingPairBalancesArray,
    balancesMap,
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
    return tokens.some((token) => pair.token0.equals(token) || pair.token1.equals(token));
  });
}

export function sortLendingPairsByAPY(lendingPairs: LendingPair[]): LendingPair[] {
  return lendingPairs.sort((a, b) => {
    const apyA = a.kitty0Info.apy + a.kitty1Info.apy;
    const apyB = b.kitty0Info.apy + b.kitty1Info.apy;
    return apyB - apyA;
  });
}
