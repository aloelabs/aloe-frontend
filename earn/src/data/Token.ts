import { Address } from 'wagmi';

export class Token {
  public readonly chainId: number;
  public readonly address: Address;
  public readonly decimals: number;
  public readonly ticker: string;
  public readonly name: string;
  public readonly iconPath: string;

  constructor(chainId: number, address: Address, decimals: number, ticker: string, name: string, iconPath: string) {
    this.chainId = chainId;
    this.address = address;
    this.decimals = decimals;
    this.ticker = ticker;
    this.name = name;
    this.iconPath = iconPath;
  }
}
