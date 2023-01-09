import { TokenType } from './actions/Actions';

export interface UserBalances {
  amount0Asset: number;
  amount1Asset: number;
}

export function getBalanceFor(tokenType: TokenType, userBalances: UserBalances): number {
  switch (tokenType) {
    case TokenType.ASSET0:
      return userBalances.amount0Asset;
    case TokenType.ASSET1:
      return userBalances.amount1Asset;
  }
}
