import { Address } from 'wagmi';

import { Token } from './Token';

export class Kitty extends Token {
  private readonly underlyingToken: Token;

  constructor(
    chainId: number,
    address: Address,
    decimals: number,
    ticker: string,
    name: string,
    iconPath: string,
    underlyingToken: Token
  ) {
    super(chainId, address, decimals, ticker, name, iconPath);
    this.underlyingToken = underlyingToken;
  }

  get underlying(): Token {
    return this.underlyingToken;
  }
}
