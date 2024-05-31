import { FeeTier, NumericFeeTierToEnum } from './FeeTier';
import { GN } from './GoodNumber';
import { Kitty } from './Kitty';
import { Token } from './Token';
import { getToken } from './TokenData';
import { Address } from 'viem';

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

export function asLendingPair(
  chainId: number,
  pool: Address,
  lender0: Address,
  lender1: Address,
  fee: number,
  getParameters: readonly [bigint, number, number, number],
  slot0: readonly [bigint, number, number, number, number, number, boolean],
  consult: readonly [bigint, bigint, bigint],
  lastWrites: readonly [number, number, bigint, bigint],
  readBasics0: readonly [Address, bigint, bigint, bigint, bigint, bigint, number, bigint],
  readBasics1: readonly [Address, bigint, bigint, bigint, bigint, bigint, number, bigint]
) {
  const token0 = getToken(chainId, readBasics0[0]);
  const token1 = getToken(chainId, readBasics1[0]);
  if (token0 == null || token1 == null) return undefined;

  const kitty0 = new Kitty(
    chainId,
    lender0,
    token0.decimals,
    `${token0.symbol}+`,
    `Aloe II ${token0.name}`,
    token0.logoURI,
    token0
  );
  const kitty1 = new Kitty(
    chainId,
    lender1,
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

  return new LendingPair(
    token0,
    token1,
    kitty0,
    kitty1,
    new KittyInfo(totalAssets0, totalBorrows0, totalSupply0, borrowAPR0, readBasics0[6]),
    new KittyInfo(totalAssets1, totalBorrows1, totalSupply1, borrowAPR1, readBasics0[6]),
    pool,
    NumericFeeTierToEnum(fee),
    Number(readBasics0[7] / 1_000_000_000_000n) / 1e6, // rewardsRate0
    Number(readBasics1[7] / 1_000_000_000_000n) / 1e6, // rewardsRate1
    asFactoryData(getParameters),
    asOracleData(consult),
    asSlot0Data(slot0),
    new Date(lastWrites[1] * 1000) // lastWrite.time
  );
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
