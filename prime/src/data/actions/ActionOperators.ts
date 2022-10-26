import JSBI from 'jsbi';
import { Address } from 'wagmi';

import { getAmountsForLiquidity, uniswapPositionKey } from '../../util/Uniswap';
import { AccountState, TokenType } from './Actions';

export function transferInOperator(operand: AccountState, token: TokenType, amount: number): AccountState {
  const assets = { ...operand.assets };
  const availableBalances = { ...operand.availableBalances };
  const requiredAllowances = { ...operand.requiredAllowances };

  switch (token) {
    case TokenType.ASSET0:
      assets.token0Raw += amount;
      availableBalances.amount0Asset -= amount;
      requiredAllowances.amount0Asset += amount;
      break;
    case TokenType.ASSET1:
      assets.token1Raw += amount;
      availableBalances.amount1Asset -= amount;
      requiredAllowances.amount1Asset += amount;
      break;
    case TokenType.KITTY0:
      assets.token0Plus += amount;
      availableBalances.amount0Kitty -= amount;
      requiredAllowances.amount0Kitty += amount;
      break;
    case TokenType.KITTY1:
      assets.token1Plus += amount;
      availableBalances.amount1Kitty -= amount;
      requiredAllowances.amount1Kitty += amount;
      break;
  }

  return { ...operand, assets, availableBalances };
}

export function transferOutOperator(operand: AccountState, token: TokenType, amount: number): AccountState {
  return transferInOperator(operand, token, -amount);
}

export function mintOperator(operand: AccountState, token: TokenType, amount: number): AccountState {
  const assets = { ...operand.assets };

  if (token === TokenType.ASSET0) {
    assets.token0Raw -= amount;
    assets.token0Plus += amount;
  } else {
    assets.token1Raw -= amount;
    assets.token1Plus += amount;
  }

  return { ...operand, assets };
}

export function burnOperator(operand: AccountState, token: TokenType, amount: number): AccountState {
  return mintOperator(operand, token, -amount);
}

export function borrowOperator(operand: AccountState, token: TokenType, amount: number): AccountState {
  const assets = { ...operand.assets };
  const liabilities = { ...operand.liabilities };

  if (token === TokenType.ASSET0) {
    assets.token0Raw += amount;
    liabilities.amount0 += amount;
  } else {
    assets.token1Raw += amount;
    liabilities.amount1 += amount;
  }

  return { ...operand, assets, liabilities };
}

export function repayOperator(operand: AccountState, token: TokenType, amount: number): AccountState {
  return borrowOperator(operand, token, -amount);
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

  assets.token0Raw -= amount0;
  assets.token1Raw -= amount1;
  assets.uni0 += amount0;
  assets.uni1 += amount1;

  const key = uniswapPositionKey(owner, lowerTick, upperTick);
  const idx = uniswapPositions.map((x) => uniswapPositionKey(owner, x.lower ?? 0, x.upper ?? 0)).indexOf(key);

  if (idx !== -1) {
    const oldPosition = { ...uniswapPositions[idx] };
    oldPosition.liquidity = JSBI.add(oldPosition.liquidity, liquidity);
    uniswapPositions[idx] = oldPosition;
  } else {
    uniswapPositions.push({ liquidity, lower: lowerTick, upper: upperTick });
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
): AccountState | null {
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

  assets.token0Raw += amount0;
  assets.token1Raw += amount1;
  assets.uni0 -= amount0;
  assets.uni1 -= amount1;

  const key = uniswapPositionKey(owner, lowerTick, upperTick);
  const idx = uniswapPositions.map((x) => uniswapPositionKey(owner, x.lower ?? 0, x.upper ?? 0)).indexOf(key);

  if (idx === -1) {
    console.error("Attempted to remove liquidity from a position that doens't exist");
    return null;
  }

  const oldPosition = { ...uniswapPositions[idx] };
  if (JSBI.lessThan(oldPosition.liquidity, liquidity)) {
    console.error('Attempted to remove more than 100% of liquidity from a position');
    return null;
  }
  oldPosition.liquidity = JSBI.subtract(oldPosition.liquidity, liquidity);
  uniswapPositions[idx] = oldPosition;

  return { ...operand, assets, uniswapPositions };
}
