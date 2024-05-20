import { GN } from './GoodNumber';
import { UniswapPosition, getAmountsForLiquidity, getAmountsForLiquidityGN } from './Uniswap';

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
