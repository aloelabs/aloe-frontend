import { isSolvent } from '../BalanceSheet';
import { MAX_UNISWAP_POSITIONS } from '../constants/Values';
import { MarginAccount } from '../MarginAccount';
import { AccountState } from './Actions';

export function runWithChecks(
  operator: (operand: AccountState) => AccountState,
  operand: AccountState | undefined,
  marginAccount: Omit<MarginAccount, 'assets' | 'liabilities'>
): AccountState {
  if (operand === undefined) throw Error('operand is undefined');
  const updatedOperand = operator(operand);

  const { assets, liabilities, uniswapPositions, availableForDeposit, availableForBorrow } = updatedOperand;

  // Sanity check (making sure we don't have too many Uniswap positions)
  if (uniswapPositions.length > MAX_UNISWAP_POSITIONS) {
    throw Error('Too many Uniswap positions');
  }

  if (assets.token0Raw.isLtZero()) {
    throw Error(`Insufficient account balance (${marginAccount.token0.symbol})`);
  } else if (assets.token1Raw.isLtZero()) {
    throw Error(`Insufficient account balance (${marginAccount.token1.symbol})`);
  } else if (assets.uni0.isLtZero()) {
    throw Error(`Not enough ${marginAccount.token0.symbol} in Uniswap`);
  } else if (assets.uni1.isLtZero()) {
    throw Error(`Not enough ${marginAccount.token1.symbol} in Uniswap`);
  } else if (liabilities.amount0.isLtZero()) {
    throw Error(`Repaying too much ${marginAccount.token0.symbol}`);
  } else if (liabilities.amount1.isLtZero()) {
    throw Error(`Repaying too much ${marginAccount.token1.symbol}`);
  } else if (availableForDeposit.amount0.isLtZero()) {
    throw Error(`Insufficient wallet balance (${marginAccount.token0.symbol})`);
  } else if (availableForDeposit.amount1.isLtZero()) {
    throw Error(`Insufficient wallet balance (${marginAccount.token1.symbol})`);
  } else if (availableForBorrow.amount0.isLtZero()) {
    throw Error(`Lending market supply depleted (${marginAccount.token0.symbol})`);
  } else if (availableForBorrow.amount1.isLtZero()) {
    throw Error(`Lending market supply depleted (${marginAccount.token1.symbol})`);
  }

  // if the action would cause insolvency, we have an issue!
  // note: Technically (in the contracts) solvency is only checked at the end of a series of actions,
  //       not after each individual one. We tried following that pattern here, but it made the UX
  //       confusing in some cases. For example, with one set of inputs, an entire set of actions would
  //       be highlighted red to show a solvency error. But upon entering a massive value for one of those
  //       actions, the code singles that one out as problematic. In reality solvency is *also* still an issue,
  //       but to the user it looks like they've fixed solvency by entering bogus data in a single action.
  // TLDR: It's simpler to check solvency inside this for loop
  const solvency = isSolvent(
    assets,
    liabilities,
    uniswapPositions,
    marginAccount.sqrtPriceX96,
    marginAccount.iv,
    marginAccount.token0.decimals,
    marginAccount.token1.decimals
  );
  if (!solvency.atA || !solvency.atB) {
    throw Error('Account unhealthy');
  }

  return updatedOperand;
}
