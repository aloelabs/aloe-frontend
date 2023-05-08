import { GN } from 'shared/lib/data/GoodNumber';

import { TokenType } from './actions/Actions';

export interface Balances {
  amount0: GN;
  amount1: GN;
}

export function getBalanceFor(tokenType: TokenType, balances: Balances): GN {
  switch (tokenType) {
    case TokenType.ASSET0:
      return balances.amount0;
    case TokenType.ASSET1:
      return balances.amount1;
  }
}
