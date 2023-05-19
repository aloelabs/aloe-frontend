import { isSolvent } from '../BalanceSheet';
import { MarginAccount } from '../MarginAccount';
import { AccountState, OperationResult } from './Actions';

export function runWithChecks(
  operator: (operand: AccountState) => OperationResult,
  operand: AccountState | undefined,
  marginAccount: Omit<MarginAccount, 'assets' | 'liabilities'>
): AccountState {
  if (operand == null) throw Error('operand is null');
  const updatedOperand = operator(operand);
  if (updatedOperand == null) throw Error('updatedOperand is null');

  if (!updatedOperand.success) throw updatedOperand.error;

  const { assets, liabilities, uniswapPositions, availableForDeposit, availableForBorrow } =
    updatedOperand.accountState;

  if (assets.token0Raw.isLtZero()) {
    throw Error(`Insufficient ${marginAccount.token0.symbol}`);
  } else if (assets.token1Raw.isLtZero()) {
    throw Error(`Insufficient ${marginAccount.token1.symbol}`);
  } else if (assets.uni0.isLtZero()) {
    throw Error(`Not enough ${marginAccount.token0.symbol} in Uniswap`);
  } else if (assets.uni1.isLtZero()) {
    throw Error(`Not enough ${marginAccount.token1.symbol} in Uniswap`);
  } else if (liabilities.amount0.isLtZero()) {
    throw Error(`Too much ${marginAccount.token0.symbol} provided`);
  } else if (liabilities.amount1.isLtZero()) {
    throw Error(`Too much ${marginAccount.token1.symbol} provided`);
  } else if (availableForDeposit.amount0.isLtZero()) {
    throw Error(`Insufficient ${marginAccount.token0.symbol} balance available for deposit`);
  } else if (availableForDeposit.amount1.isLtZero()) {
    throw Error(`Insufficient ${marginAccount.token1.symbol} balance available for deposit`);
  } else if (availableForBorrow.amount0.isLtZero()) {
    throw Error(`Insufficient ${marginAccount.token0.symbol} available for borrow`);
  } else if (availableForBorrow.amount1.isLtZero()) {
    throw Error(`Insufficient ${marginAccount.token1.symbol} available for borrow`);
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
    throw Error('Margin Account is not solvent');
  }

  return updatedOperand.accountState;
}
