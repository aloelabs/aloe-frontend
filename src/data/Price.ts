import { TokenData } from "./TokenData";

export class Price{
  public readonly value: number;
  public readonly token0: TokenData;
  public readonly token1: TokenData;

  constructor(value: number, token0: TokenData, token1: TokenData) {
    this.value = value;
    this.token0 = token0;
    this.token1 = token1;
  }

  public invert(): Price {
    return new Price(1.0 / this.value, this.token0, this.token1);
  }
}