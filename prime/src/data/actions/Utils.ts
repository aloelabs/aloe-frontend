import { MarginAccount, isSolvent } from '../MarginAccount';
import { ActionCardOperand } from './Actions';

export function runWithChecks<T extends unknown[]>(
  marginAccount: Omit<MarginAccount, 'assets' | 'liabilities'>,
  operator: (operand: ActionCardOperand, ...args: T) => ActionCardOperand | undefined,
  operand: ActionCardOperand | undefined,
  ...args: T
): ActionCardOperand | undefined {
  if (operand === undefined) return undefined;
  const updatedOperand = operator(operand, ...args);
  if (updatedOperand === undefined) return undefined;

  const { assets, liabilities, uniswapPositions, availableBalances } = updatedOperand;

  // if any assets or liabilities are < 0, we have an issue!
  if (
    Object.values(assets).find((x) => x < 0) ||
    Object.values(liabilities).find((x) => x < 0) ||
    Object.values(availableBalances).find((x) => x < 0)
  ) {
    console.log('Margin Account or EOA balance dropped below 0!');
    return undefined;
  }

  // if the action would cause insolvency, we have an issue!
  // note: Technically (in the contracts) solvency is only checked at the end of a series of actions,
  //       not after each individual one. We tried following that pattern here, but it made the UX
  //       confusing in some cases. For example, with one set of inputs, an entire set of actions would
  //       be highlighted red to show a solvency error. But upon entering a massive value for one of those
  //       actions, the code singles that one out as problematic. In reality solvency is *also* still an issue,
  //       but to the user it looks like they've fixed solvency by entering bogus data in a single action.
  // TLDR: It's simpler to check solvency inside this for loop
  const includeKittyReceipts = assets.token0Plus > 0 || assets.token1Plus > 0;
  const solvency = isSolvent(
    {
      ...marginAccount,
      assets,
      liabilities,
      includeKittyReceipts,
    },
    uniswapPositions,
    marginAccount.sqrtPriceX96,
    0.025
  );
  if (!solvency.atA || !solvency.atB) {
    console.log('Margin Account not solvent!');
    console.log(solvency);
    return undefined;
  }

  return updatedOperand;
}
