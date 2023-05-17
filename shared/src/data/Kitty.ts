import { Address } from 'wagmi';

import { Token } from './Token';

export class Kitty extends Token {
  private readonly underlyingToken: Token;

  constructor(
    chainId: number,
    address: Address,
    decimals: number,
    symbol: string,
    name: string,
    logoURI: string,
    underlyingToken: Token
  ) {
    super(chainId, address, decimals, symbol, name, logoURI);
    this.underlyingToken = underlyingToken;
  }

  get underlying(): Token {
    return this.underlyingToken;
  }
}
