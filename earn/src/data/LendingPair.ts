import { AxiosResponse } from 'axios';
import Big from 'big.js';
import { CallReturnContext, ContractCallContext, Multicall } from 'ethereum-multicall';
import { ethers } from 'ethers';
import { FeeTier, NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { Address, Chain } from 'wagmi';

import ERC20ABI from '../assets/abis/ERC20.json';
import KittyABI from '../assets/abis/Kitty.json';
import KittyLensABI from '../assets/abis/KittyLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import VolatilityOracleABI from '../assets/abis/VolatilityOracle.json';
import { makeEtherscanRequest } from '../util/Etherscan';
import { convertBigNumbersForReturnContexts } from '../util/Multicall';
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
  const multicall = new Multicall({ ethersProvider: provider });
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

  const contractCallContexts: ContractCallContext[] = [];

  addresses.forEach((market) => {
    contractCallContexts.push({
      reference: `basics0-${market.pool}`,
      contractAddress: ALOE_II_KITTY_LENS_ADDRESS,
      abi: KittyLensABI,
      calls: [
        {
          reference: `basics0-${market.pool}`,
          methodName: 'readBasics',
          methodParameters: [market.kitty0],
        },
      ],
      context: { kitty0Address: market.kitty0 },
    });

    contractCallContexts.push({
      reference: `basics1-${market.pool}`,
      contractAddress: ALOE_II_KITTY_LENS_ADDRESS,
      abi: KittyLensABI,
      calls: [
        {
          reference: `basics1-${market.pool}`,
          methodName: 'readBasics',
          methodParameters: [market.kitty1],
        },
      ],
      context: { kitty1Address: market.kitty1 },
    });

    contractCallContexts.push({
      reference: `feeTier-${market.pool}`,
      contractAddress: market.pool,
      abi: UniswapV3PoolABI,
      calls: [
        {
          reference: `feeTier-${market.pool}`,
          methodName: 'fee',
          methodParameters: [],
        },
      ],
    });

    contractCallContexts.push({
      reference: `oracleResult-${market.pool}`,
      contractAddress: ALOE_II_ORACLE,
      abi: VolatilityOracleABI,
      calls: [
        {
          reference: `oracleResult-${market.pool}`,
          methodName: 'consult',
          methodParameters: [market.pool],
        },
      ],
    });
  });

  const results = await multicall.call(contractCallContexts);

  let lendingPairReturnContexts: Map<string, [CallReturnContext, any][]> = new Map();
  let lendingPairs: LendingPair[] = [];
  Object.values(results.results).forEach((result) => {
    const returnContext = convertBigNumbersForReturnContexts(result.callsReturnContext)[0];
    const refId = returnContext.reference.split('-')[1];
    if (lendingPairReturnContexts.has(refId)) {
      lendingPairReturnContexts.get(refId)?.push([returnContext, result.originalContractCallContext?.context]);
    } else {
      lendingPairReturnContexts.set(refId, [[returnContext, result.originalContractCallContext?.context]]);
    }
  });

  Array.from(lendingPairReturnContexts.values()).forEach((returnContexts) => {
    const basics0 = returnContexts[0][0].returnValues;
    const basics1 = returnContexts[1][0].returnValues;
    const feeTier = returnContexts[2][0].returnValues;
    const oracleResult = returnContexts[3][0].returnValues;
    const { kitty0Address } = returnContexts[0][1];
    const { kitty1Address } = returnContexts[1][1];

    const token0 = getToken(chain.id, basics0[0]);
    const token1 = getToken(chain.id, basics1[0]);
    if (token0 == null || token1 == null) return;
    const kitty0 = new Kitty(
      chain.id,
      kitty0Address as Address,
      token0.decimals,
      `${token0.ticker}+`,
      `Aloe II ${token0.name}`,
      token0.iconPath,
      token0
    );
    const kitty1 = new Kitty(
      chain.id,
      kitty1Address as Address,
      token1.decimals,
      `${token1.ticker}+`,
      `Aloe II ${token1.name}`,
      token1.iconPath,
      token1
    );

    const interestRate0 = new Big(basics0[1].toString());
    const interestRate1 = new Big(basics1[1].toString());

    const utilization0 = new Big(basics0[2].toString()).div(10 ** 18).toNumber();
    const utilization1 = new Big(basics1[2].toString()).div(10 ** 18).toNumber();

    const inventory0 = new Big(basics0[3].toString()).div(10 ** token0.decimals).toNumber();
    const inventory1 = new Big(basics1[3].toString()).div(10 ** token1.decimals).toNumber();

    const totalSupply0 = new Big(basics0[5].toString()).div(10 ** kitty0.decimals).toNumber();
    const totalSupply1 = new Big(basics1[5].toString()).div(10 ** kitty1.decimals).toNumber();

    // SupplyAPY = Utilization * (1 - reservePercentage) * BorrowAPY
    const APY0 = utilization0 * (1 - 1 / 8) * (interestRate0.div(10 ** 12).toNumber() ** (365 * 24 * 60 * 60) - 1.0);
    const APY1 = utilization1 * (1 - 1 / 8) * (interestRate1.div(10 ** 12).toNumber() ** (365 * 24 * 60 * 60) - 1.0);

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
