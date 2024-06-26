import { Address, Hex } from 'viem';
import { GN } from './GoodNumber';
import { UniswapPosition, getAmountsForLiquidity, getAmountsForLiquidityGN } from './Uniswap';
import { ALOE_II_LIQUIDATION_GRACE_PERIOD } from './constants/Values';
import { auctionCurve, computeAuctionAmounts, isHealthy } from './BalanceSheet';
import { Token } from './Token';

export class Assets {
  constructor(
    public readonly amount0: GN,
    public readonly amount1: GN,
    public readonly uniswapPositions: UniswapPosition[]
  ) {}

  amountsAt(tick: number) {
    let amount0 = this.amount0.toNumber();
    let amount1 = this.amount1.toNumber();
    for (const uniswapPosition of this.uniswapPositions) {
      const [temp0, temp1] = getAmountsForLiquidity(
        uniswapPosition,
        tick,
        this.amount0.resolution,
        this.amount1.resolution
      );

      amount0 += temp0;
      amount1 += temp1;
    }

    return [amount0, amount1];
  }

  amountsAtSqrtPrice(sqrtPriceX96: GN) {
    let amount0 = this.amount0;
    let amount1 = this.amount1;

    for (const uniswapPosition of this.uniswapPositions) {
      const temp = getAmountsForLiquidityGN(uniswapPosition, sqrtPriceX96.toJSBI());

      amount0 = amount0.recklessAdd(temp.amount0.toString(10));
      amount1 = amount1.recklessAdd(temp.amount1.toString(10));
    }

    return { amount0, amount1 };
  }
}

export type Liabilities = {
  amount0: number;
  amount1: number;
};

type Data = {
  /** The borrower's current Ether balance */
  readonly ethBalance: GN;
  /** The borrower's current `Assets` */
  readonly assets: Assets;
  /** The borrower's current liabilities */
  readonly liabilities: { amount0: GN; amount1: GN };
  /** The current value of `borrower.slot0()` (onchain) */
  readonly slot0: bigint;
  /** The borrower's address */
  readonly address: Address;
  /** The owner of the borrower */
  readonly owner: Address;
  /** The Uniswap pool to which the borrower belongs */
  readonly uniswapPool: {
    readonly address: Address;
    readonly fee: number;
  };
  /** The Uniswap pool's `token0` */
  readonly token0: Token;
  /** The Uniswap pool's `token1` */
  readonly token1: Token;
};

export type Borrower = DerivedBorrower & Data;

export class DerivedBorrower {
  // NOTE: You can't use parameter destructuring and constructor-inferred instance variables at the same
  // time. To avoid code duplication, I've split the readonly `Data` type into its own thing, and used
  // a proxy-based factory pattern.
  // Oh, and the reason I want parameter destructuring is so that elements of `data` are labelled
  // whenever creating `Borrower`s.
  private constructor(private readonly data: Data) {}

  public static from(data: Data): Borrower {
    const borrower = new DerivedBorrower(data);

    return new Proxy(borrower, {
      get(target, prop: keyof DerivedBorrower | keyof Data) {
        if (prop in target) {
          // First look for property on `Borrower` itself
          return target[prop as keyof DerivedBorrower];
        } else if (prop in target.data) {
          // If it doesn't exist, check inside `data`
          return target.data[prop as keyof Data];
        } else {
          throw new Error(`Property '${String(prop)}' does not exist on Borrower or Borrower.data`);
        }
      },
    }) as Borrower;
  }

  public get userData() {
    return `0x${((this.data.slot0 >> 144n) & BigInt('0xffffffffffffffff')).toString(16)}` as Hex;
  }

  public get warnTime() {
    return Number((this.data.slot0 >> 208n) & BigInt(`0xffffffffff`));
  }

  public get auctionTime() {
    const t = this.warnTime;
    if (t === 0) return undefined;

    return Date.now() / 1000 - (t + ALOE_II_LIQUIDATION_GRACE_PERIOD);
  }

  public get auctionCurveValue() {
    const t = this.auctionTime;
    if (t === undefined || t < 0) return undefined;

    return auctionCurve(t);
  }

  public warnIncentive(ante: GN) {
    return GN.min(this.data.ethBalance, ante.recklessDiv(4));
  }

  public nominalLiquidationIncentive(sqrtPriceX96: GN, closeFactor: number) {
    const t = this.auctionTime;
    if (t === undefined || t < 0) return undefined;

    const { amount0: assets0, amount1: assets1 } = this.data.assets.amountsAtSqrtPrice(sqrtPriceX96);
    const { out0, out1, repay0, repay1 } = computeAuctionAmounts(
      sqrtPriceX96,
      assets0,
      assets1,
      this.data.liabilities.amount0,
      this.data.liabilities.amount1,
      t,
      closeFactor
    );

    return {
      amount0: out0.sub(repay0),
      amount1: out1.sub(repay1),
      amountEth: Math.abs(1 - closeFactor) < Number.EPSILON * 2 ? this.data.ethBalance : GN.zero(18),
    };
  }

  // TODO: this is kinda messy and imprecise
  public health(sqrtPriceX96: Big, iv: number, nSigma: number) {
    return isHealthy(
      this.data.assets,
      {
        amount0: this.data.liabilities.amount0.toNumber(),
        amount1: this.data.liabilities.amount1.toNumber(),
      },
      sqrtPriceX96,
      iv,
      nSigma,
      this.data.assets.amount0.resolution,
      this.data.assets.amount1.resolution
    );
  }
}
