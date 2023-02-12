import { TokenType } from './actions/Actions';

export interface Balances {
  amount0: number;
  amount1: number;
}

export function getBalanceFor(tokenType: TokenType, balances: Balances): number {
  switch (tokenType) {
    case TokenType.ASSET0:
      return balances.amount0;
    case TokenType.ASSET1:
      return balances.amount1;
  }
}
