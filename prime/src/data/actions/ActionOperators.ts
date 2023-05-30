import JSBI from 'jsbi';
import { GN } from 'shared/lib/data/GoodNumber';
import { Address } from 'wagmi';

import { getAmountsForLiquidity, uniswapPositionKey } from '../../util/Uniswap';
import { MAX_UNISWAP_POSITIONS } from '../constants/Values';
import { AccountState, TokenType } from './Actions';

export function transferInOperator(operand: AccountState, token: TokenType, amount: GN): AccountState {
  const assets = { ...operand.assets };
  const availableForDeposit = { ...operand.availableForDeposit };
  const requiredAllowances = { ...operand.requiredAllowances };

  switch (token) {
    case TokenType.ASSET0:
      assets.token0Raw = assets.token0Raw.add(amount);
      availableForDeposit.amount0 = availableForDeposit.amount0.sub(amount);
      requiredAllowances.amount0 = requiredAllowances.amount0.add(amount);
      break;
    case TokenType.ASSET1:
      assets.token1Raw = assets.token1Raw.add(amount);
      availableForDeposit.amount1 = availableForDeposit.amount1.sub(amount);
      requiredAllowances.amount1 = requiredAllowances.amount1.add(amount);
      break;
  }

  return {
    ...operand,
    assets,
    availableForDeposit,
    requiredAllowances,
  };
}

export function transferOutOperator(operand: AccountState, token: TokenType, amount: GN): AccountState {
  return transferInOperator(operand, token, amount.neg());
}

export function mintOperator(operand: AccountState, token: TokenType, amount: GN): AccountState {
  const assets = { ...operand.assets };

  if (token === TokenType.ASSET0) {
    assets.token0Raw = assets.token0Raw.sub(amount);
  } else {
    assets.token1Raw = assets.token1Raw.sub(amount);
  }

  return { ...operand, assets };
}

export function burnOperator(operand: AccountState, token: TokenType, amount: GN): AccountState {
  return mintOperator(operand, token, amount.neg());
}

export function borrowOperator(operand: AccountState, token: TokenType, amount: GN): AccountState {
  const assets = { ...operand.assets };
  const liabilities = { ...operand.liabilities };
  const availableForBorrow = { ...operand.availableForBorrow };

  if (token === TokenType.ASSET0) {
    assets.token0Raw = assets.token0Raw.add(amount);
    liabilities.amount0 = liabilities.amount0.add(amount);
    availableForBorrow.amount0 = availableForBorrow.amount0.sub(amount);
  } else {
    assets.token1Raw = assets.token1Raw.add(amount);
    liabilities.amount1 = liabilities.amount1.add(amount);
    availableForBorrow.amount1 = availableForBorrow.amount1.sub(amount);
  }

  return {
    ...operand,
    assets,
    liabilities,
    availableForBorrow,
  };
}

export function repayOperator(operand: AccountState, token: TokenType, amount: GN): AccountState {
  return borrowOperator(operand, token, amount.neg());
}

export function addLiquidityOperator(
  operand: AccountState,
  owner: Address,
  liquidity: JSBI,
  lowerTick: number,
  upperTick: number,
  currentTick: number,
  token0Decimals: number,
  token1Decimals: number
): AccountState {
  const assets = { ...operand.assets };
  const uniswapPositions = operand.uniswapPositions.concat();

  const [amount0, amount1] = getAmountsForLiquidity(
    liquidity,
    lowerTick,
    upperTick,
    currentTick,
    token0Decimals,
    token1Decimals
  );

  assets.token0Raw = assets.token0Raw.sub(amount0);
  assets.token1Raw = assets.token1Raw.sub(amount1);
  assets.uni0 = assets.uni0.add(amount0);
  assets.uni1 = assets.uni1.add(amount1);

  const key = uniswapPositionKey(owner, lowerTick, upperTick);
  const idx = uniswapPositions.map((x) => uniswapPositionKey(owner, x.lower ?? 0, x.upper ?? 0)).indexOf(key);

  if (idx !== -1) {
    const oldPosition = { ...uniswapPositions[idx] };
    oldPosition.liquidity = JSBI.add(oldPosition.liquidity, liquidity);
    uniswapPositions[idx] = oldPosition;
  } else {
    uniswapPositions.push({ liquidity, lower: lowerTick, upper: upperTick });
  }

  if (uniswapPositions.length > MAX_UNISWAP_POSITIONS) {
    throw Error('Too many uniswap positions');
  }

  return { ...operand, assets, uniswapPositions };
}

export function removeLiquidityOperator(
  operand: AccountState,
  owner: Address,
  liquidity: JSBI,
  lowerTick: number,
  upperTick: number,
  currentTick: number,
  token0Decimals: number,
  token1Decimals: number
): AccountState {
  const assets = { ...operand.assets };
  const uniswapPositions = operand.uniswapPositions.concat();
  const claimedFeeUniswapKeys = operand.claimedFeeUniswapKeys.concat();

  const [amount0, amount1] = getAmountsForLiquidity(
    liquidity,
    lowerTick,
    upperTick,
    currentTick,
    token0Decimals,
    token1Decimals
  );

  assets.token0Raw = assets.token0Raw.add(amount0);
  assets.token1Raw = assets.token1Raw.add(amount1);
  assets.uni0 = assets.uni0.sub(amount0);
  assets.uni1 = assets.uni1.sub(amount1);

  const key = uniswapPositionKey(owner, lowerTick, upperTick);
  const idx = uniswapPositions.map((x) => uniswapPositionKey(owner, x.lower ?? 0, x.upper ?? 0)).indexOf(key);

  if (idx === -1) {
    throw Error("Attempted to remove liquidity from a position that doens't exist");
  }

  const oldPosition = { ...uniswapPositions[idx] };
  if (JSBI.lessThan(oldPosition.liquidity, liquidity)) {
    throw Error('Attempted to remove more than 100% of liquidity from a position');
  }
  oldPosition.liquidity = JSBI.subtract(oldPosition.liquidity, liquidity);
  uniswapPositions[idx] = oldPosition;
  claimedFeeUniswapKeys.push(key);

  // eslint-disable-next-line object-curly-newline
  return { ...operand, assets, uniswapPositions, claimedFeeUniswapKeys };
}

export function swapOperator(operand: AccountState, amount0: GN, amount1: GN): AccountState {
  const assets = { ...operand.assets };

  assets.token0Raw = assets.token0Raw.add(amount0);
  assets.token1Raw = assets.token1Raw.add(amount1);

  return { ...operand, assets };
}
