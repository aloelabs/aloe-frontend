import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { BigNumber, ethers } from 'ethers';
import JSBI from 'jsbi';
import { erc20Abi } from '../abis/ERC20';
import { factoryAbi } from '../abis/Factory';
import { lenderAbi } from '../abis/Lender';
import { lenderLensAbi } from '../abis/LenderLens';
import { uniswapV3PoolAbi } from '../abis/UniswapV3Pool';
import { volatilityOracleAbi } from '../abis/VolatilityOracle';
import {
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_LENDER_LENS_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
  MULTICALL_ADDRESS,
} from './constants/ChainSpecific';
import { Q32 } from './constants/Values';
import { FeeTier, NumericFeeTierToEnum } from './FeeTier';
import { GN } from './GoodNumber';
import { Kitty } from './Kitty';
import { Token } from './Token';
import { getToken } from './TokenData';
import { toImpreciseNumber } from '../util/Numbers';
import { Address, getContract, PublicClient, zeroAddress } from 'viem';

import { asFactoryData, FactoryData } from './FactoryData';
import { asOracleData, OracleData } from './OracleData';
import { borrowAPRToLendAPY, RateModel, yieldPerSecondToAPR } from './RateModel';
import { asSlot0Data, Slot0Data } from './Slot0Data';
import { computeLTV } from './BalanceSheet';

const SECONDS_IN_YEAR = 365n * 24n * 60n * 60n;

export class KittyInfo {
  public readonly availableAssets: GN;
  public readonly utilization: number;
  public readonly lendAPY: number;

  constructor(
    public readonly totalAssets: GN,
    public readonly totalBorrows: GN,
    public readonly totalSupply: GN,
    public readonly borrowAPR: number,
    public readonly reserveFactor: number
  ) {
    this.availableAssets = totalAssets.sub(totalBorrows);
    this.utilization = totalAssets.isGtZero() ? totalBorrows.div(totalAssets).toNumber() : 0;
    this.lendAPY = borrowAPRToLendAPY(borrowAPR, this.utilization, reserveFactor);
  }

  hypotheticalBorrowAPR(additionalBorrowAmount: GN) {
    // If there are no assets, the utilization will be 0, so the borrowAPR will be 0.
    if (this.totalAssets.isZero()) return 0;
    const hypotheticalUtilization = this.totalBorrows.add(additionalBorrowAmount).div(this.totalAssets);
    // TODO: This only works for the current RateModel. If there are others, we'll need to update this.
    return yieldPerSecondToAPR(RateModel.computeYieldPerSecond(hypotheticalUtilization.toNumber()));
  }
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
    public rewardsRate0: number,
    public rewardsRate1: number,
    public factoryData: FactoryData,
    public oracleData: OracleData,
    public slot0Data: Slot0Data,
    public lastWrite: Date
  ) {}

  equals(other: LendingPair) {
    return other.kitty0.address === this.kitty0.address && other.kitty1.address === this.kitty1.address;
  }

  get iv() {
    return this.oracleData.iv.toNumber();
  }

  get ltv() {
    return computeLTV(this.iv, this.factoryData.nSigma);
  }

  get manipulationThreshold() {
    return -Math.log(this.ltv) / Math.log(1.0001) / this.factoryData.manipulationThresholdDivisor;
  }

  amountEthRequiredBeforeBorrowing(currentBorrowerBalance: bigint) {
    const ante = this.factoryData.ante.toBigInt();
    return currentBorrowerBalance >= ante ? 0n : ante - currentBorrowerBalance;
  }
}

export type LendingPairBalances = {
  token0Balance: number;
  token1Balance: number;
  kitty0Balance: number;
  kitty1Balance: number;
};

export type LendingPairBalancesMap = Map<Address, { value: number; gn: GN; form: 'raw' | 'underlying' }>;

export async function getAvailableLendingPairs(chainId: number, publicClient: PublicClient): Promise<LendingPair[]> {
  const factory = getContract({
    abi: factoryAbi,
    address: ALOE_II_FACTORY_ADDRESS[chainId],
    client: publicClient,
  });

  const logs = await factory.getEvents.CreateMarket({}, { strict: true, fromBlock: 'earliest', toBlock: 'latest' });
  if (logs.length === 0) return [];

  const lenderLens = getContract({
    abi: lenderLensAbi,
    address: ALOE_II_LENDER_LENS_ADDRESS[chainId],
    client: publicClient,
  });

  const oracle = getContract({
    abi: volatilityOracleAbi,
    address: ALOE_II_ORACLE_ADDRESS[chainId],
    client: publicClient,
  });

  const reads = await Promise.all(
    logs.map((log) =>
      Promise.all([
        factory.read.getParameters([log.args.pool!]),
        oracle.read.consult([log.args.pool!, Q32]),
        oracle.read.lastWrites([log.args.pool!]),
        lenderLens.read.readBasics([log.args.lender0!]),
        lenderLens.read.readBasics([log.args.lender1!]),
        publicClient.readContract({
          abi: uniswapV3PoolAbi,
          address: log.args.pool!,
          functionName: 'slot0',
        }),
        publicClient.readContract({
          abi: uniswapV3PoolAbi,
          address: log.args.pool!,
          functionName: 'fee',
        }),
      ])
    )
  );

  const lendingPairs: LendingPair[] = [];

  logs.forEach((log, i) => {
    const [getParameters, consult, lastWrites, readBasics0, readBasics1, slot0, fee] = reads[i];

    const token0 = getToken(chainId, readBasics0[0]);
    const token1 = getToken(chainId, readBasics1[0]);
    if (token0 == null || token1 == null) return;

    const kitty0 = new Kitty(
      chainId,
      log.args.lender0!,
      token0.decimals,
      `${token0.symbol}+`,
      `Aloe II ${token0.name}`,
      token0.logoURI,
      token0
    );
    const kitty1 = new Kitty(
      chainId,
      log.args.lender1!,
      token1.decimals,
      `${token1.symbol}+`,
      `Aloe II ${token1.name}`,
      token1.logoURI,
      token1
    );

    const borrowAPR0 = Number((readBasics0[1] * SECONDS_IN_YEAR) / 1_000_000n) / 1e6;
    const borrowAPR1 = Number((readBasics1[1] * SECONDS_IN_YEAR) / 1_000_000n) / 1e6;

    const totalAssets0 = GN.fromBigInt(readBasics0[3], token0.decimals);
    const totalAssets1 = GN.fromBigInt(readBasics1[3], token1.decimals);

    const totalBorrows0 = GN.fromBigInt(readBasics0[4], token0.decimals);
    const totalBorrows1 = GN.fromBigInt(readBasics1[4], token1.decimals);

    const totalSupply0 = GN.fromBigInt(readBasics0[5], kitty0.decimals);
    const totalSupply1 = GN.fromBigInt(readBasics1[5], kitty1.decimals);

    lendingPairs.push(
      new LendingPair(
        token0,
        token1,
        kitty0,
        kitty1,
        new KittyInfo(totalAssets0, totalBorrows0, totalSupply0, borrowAPR0, readBasics0[6]),
        new KittyInfo(totalAssets1, totalBorrows1, totalSupply1, borrowAPR1, readBasics0[6]),
        log.args.pool!,
        NumericFeeTierToEnum(fee),
        Number(readBasics0[7] / 1_000_000_000_000n) / 1e6, // rewardsRate0
        Number(readBasics1[7] / 1_000_000_000_000n) / 1e6, // rewardsRate1
        asFactoryData(getParameters),
        asOracleData(consult),
        asSlot0Data(slot0),
        new Date(lastWrites[1] * 1000) // lastWrite.time
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

  const ethBalance = await provider.getBalance(userAddress);

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

  balancesMap.set(zeroAddress, {
    value: GN.fromBigNumber(ethBalance, 18).toNumber(),
    gn: GN.fromBigNumber(ethBalance, 18),
    form: 'raw',
  });

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
      token0Balance: toImpreciseNumber(
        BigNumber.from(hexes[0]).add(lendingPair.token0.name === 'Wrapped Ether' ? ethBalance : 0),
        lendingPair.token0.decimals
      ),
      token1Balance: toImpreciseNumber(
        BigNumber.from(hexes[1]).add(lendingPair.token1.name === 'Wrapped Ether' ? ethBalance : 0),
        lendingPair.token1.decimals
      ),
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
    const apyA = a.kitty0Info.lendAPY + a.kitty1Info.lendAPY;
    const apyB = b.kitty0Info.lendAPY + b.kitty1Info.lendAPY;
    return apyB - apyA;
  });
}
