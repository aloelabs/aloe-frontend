import { TokenType } from './actions/Actions';

export interface UserBalances {
  amount0Asset: number;
  amount1Asset: number;
  amount0Kitty: number;
  amount1Kitty: number;
}

export function getBalanceFor(tokenType: TokenType, userBalances: UserBalances): number {
  switch (tokenType) {
    case TokenType.ASSET0:
      return userBalances.amount0Asset;
    case TokenType.ASSET1:
      return userBalances.amount1Asset;
    case TokenType.KITTY0:
      return userBalances.amount0Kitty;
    case TokenType.KITTY1:
      return userBalances.amount1Kitty;
  }
}
