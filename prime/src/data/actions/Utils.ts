import { MAX_UNISWAP_POSITIONS } from '../constants/Values';
import { MarginAccount, isSolvent } from '../MarginAccount';
import { AccountState } from './Actions';

export function runWithChecks(
  operator: (operand: AccountState) => AccountState | null,
  operand: AccountState | undefined,
  marginAccount: Omit<MarginAccount, 'assets' | 'liabilities'>
): AccountState | null {
  if (operand == null) return null;
  const updatedOperand = operator(operand);
  if (updatedOperand == null) return null;

  const { assets, liabilities, uniswapPositions, availableBalances } = updatedOperand;

  // if any assets or liabilities are < 0, we have an issue!
  if (
    Object.values(assets).find((x) => x < 0) ||
    Object.values(liabilities).find((x) => x < 0) ||
    Object.values(availableBalances).find((x) => x < 0)
  ) {
    console.log('Margin Account or EOA balance dropped below 0!');
    return null;
  }

  // if the action would cause insolvency, we have an issue!
  // note: Technically (in the contracts) solvency is only checked at the end of a series of actions,
  //       not after each individual one. We tried following that pattern here, but it made the UX
  //       confusing in some cases. For example, with one set of inputs, an entire set of actions would
  //       be highlighted red to show a solvency error. But upon entering a massive value for one of those
  //       actions, the code singles that one out as problematic. In reality solvency is *also* still an issue,
  //       but to the user it looks like they've fixed solvency by entering bogus data in a single action.
  // TLDR: It's simpler to check solvency inside this for loop
  const updatedMarginAccount = {
    ...marginAccount,
    assets,
    liabilities,
  };
  const solvency = isSolvent(updatedMarginAccount, uniswapPositions, marginAccount.sqrtPriceX96);
  if (!solvency.atA || !solvency.atB) {
    console.log('Margin Account not solvent!');
    console.log(solvency);
    return null;
  }

  // Check that there are not too many Uniswap positions
  if (uniswapPositions.length > MAX_UNISWAP_POSITIONS) {
    console.log('Too many Uniswap positions!');
    return null;
  }

  return updatedOperand;
}
