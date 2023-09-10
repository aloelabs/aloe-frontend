import { Address } from 'wagmi';

export class Token {
  public readonly chainId: number;
  public readonly address: Address;
  public readonly decimals: number;
  public readonly symbol: string;
  public readonly name: string;
  public readonly logoURI: string;
  public readonly isRestricted: boolean;

  constructor(
    chainId: number,
    address: Address,
    decimals: number,
    symbol: string,
    name: string,
    logoURI: string,
    isRestricted = false
  ) {
    this.chainId = chainId;
    this.address = address;
    this.decimals = decimals;
    this.symbol = symbol;
    this.name = name;
    this.logoURI = logoURI;
    this.isRestricted = isRestricted;
  }

  get underlying(): Token {
    return this;
  }

  equals(other: Token): boolean {
    return this.chainId === other.chainId && this.address.toLowerCase() === other.address.toLowerCase();
  }
}
