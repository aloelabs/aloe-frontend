import JSBI from 'jsbi';
import { DropdownOption } from 'shared/lib/components/common/Dropdown';

import { ReactComponent as AloeLogo } from '../../assets/svg/aloe_capital_logo.svg';
import { ReactComponent as UniswapLogo } from '../../assets/svg/uniswap_logo.svg';
import { AloeAddMarginActionCard } from '../../components/borrow/actions/AloeAddMarginActionCard';
import { AloeBorrowActionCard } from '../../components/borrow/actions/AloeBorrowActionCard';
import { AloeBurnTokenPlusActionCard } from '../../components/borrow/actions/AloeBurnTokenPlusActionCard';
import { AloeMintTokenPlusActionCard } from '../../components/borrow/actions/AloeMintTokenPlusActionCard';
import { AloeRepayActionCard } from '../../components/borrow/actions/AloeRepayActionCard';
import { AloeWithdrawActionCard } from '../../components/borrow/actions/AloeWithdrawActionCard';
import UniswapAddLiquidityActionCard from '../../components/borrow/actions/UniswapAddLiquidityActionCard';
import UnsiwapClaimFeesActionCard from '../../components/borrow/actions/UniswapClaimFeesActionCard';
import UniswapRemoveLiquidityActionCard from '../../components/borrow/actions/UniswapRemoveLiquidityActionCard';
import { deepCopyMap } from '../../util/Maps';
import { getAmountsForLiquidity, sqrtRatioToTick, uniswapPositionKey } from '../../util/Uniswap';
import { Assets, isSolvent, Liabilities, MarginAccount } from '../MarginAccount';
import { UserBalances } from '../UserBalances';
import { ActionID } from './ActionID';

export type UniswapPosition = {
  lower: number;
  upper: number;
  liquidity: JSBI;
};

export type UniswapPositionPrior = Omit<UniswapPosition, 'amount0' | 'amount1' | 'liquidity'>;

export enum TokenType {
  ASSET0 = 'ASSET0',
  ASSET1 = 'ASSET1',
  KITTY0 = 'KITTY0',
  KITTY1 = 'KITTY1',
}

export type AloeResult = {
  token0RawDelta?: number;
  token1RawDelta?: number;
  token0DebtDelta?: number;
  token1DebtDelta?: number;
  token0PlusDelta?: number;
  token1PlusDelta?: number;
  selectedToken: TokenType | null;
};

export type UniswapResult = {
  uniswapPosition: UniswapPosition;
  slippageTolerance?: number;
  removeLiquidityPercentage?: number;
  isToken0Selected?: boolean;
  isAmount0LastUpdated?: boolean;
};

export interface ActionCardOperand {
  readonly assets: Assets;
  readonly liabilities: Liabilities;
  readonly uniswapPositions: readonly UniswapPosition[];
  readonly availableBalances: UserBalances;
  readonly requiredAllowances: UserBalances;
}

export type ActionCardState = {
  actionId: ActionID;
  actionArgs?: string;
  textFields?: string[];
  operator: (operand: ActionCardOperand | null) => ActionCardOperand | null;
  aloeResult: AloeResult | null;
  uniswapResult: UniswapResult | null;
};

export type CumulativeActionCardResult = {
  aloeResult: AloeResult | null;
  uniswapPositions: UniswapPosition[];
};

export type ActionCardProps = {
  marginAccount: MarginAccount;
  availableBalances: UserBalances;
  uniswapPositions: UniswapPosition[];
  previousActionCardState: ActionCardState | null;
  isCausingError: boolean;
  onRemove: () => void;
  onChange: (result: ActionCardState) => void;
};

export type Action = {
  id: ActionID;
  description: string;
  actionCard: React.FC<ActionCardProps>;
};

export type ActionProvider = {
  name: string;
  Icon: React.FC;
  color: string;
  actions: {
    [key: string]: Action;
  };
};

export type ActionTemplate = {
  name: string;
  description: string;
  actions: Array<Action>;
  defaultActionStates?: Array<ActionCardState>;
};

export const MINT_TOKEN_PLUS: Action = {
  id: ActionID.MINT,
  description:
    'Exchange raw assets for their interest-bearing counterpart. Using these as collateral reduces maximum leverage.',
  actionCard: AloeMintTokenPlusActionCard,
};

export const BURN_TOKEN_PLUS: Action = {
  id: ActionID.BURN,
  description: 'Exchange interest-bearing tokens for the underlying asset.',
  actionCard: AloeBurnTokenPlusActionCard,
};

export const BORROW: Action = {
  id: ActionID.BORROW,
  description: "Request assets from the money market. This won't work if market utilization is already at 100%.",
  actionCard: AloeBorrowActionCard,
};

export const REPAY: Action = {
  id: ActionID.REPAY,
  description: 'Pay off your loans.',
  actionCard: AloeRepayActionCard,
};

export const WITHDRAW: Action = {
  id: ActionID.TRANSFER_OUT,
  description: 'Send funds from your Margin Account to your wallet.',
  actionCard: AloeWithdrawActionCard,
};

export const ADD_MARGIN: Action = {
  id: ActionID.TRANSFER_IN,
  description: 'Send funds from your wallet to your Margin Account. You must do this before anything else.',
  actionCard: AloeAddMarginActionCard,
};

export const ADD_LIQUIDITY: Action = {
  id: ActionID.ADD_LIQUIDITY,
  description: 'Create a new Uniswap Position or add liquidity to an existing one.',
  actionCard: UniswapAddLiquidityActionCard,
};

export const REMOVE_LIQUIDITY: Action = {
  id: ActionID.REMOVE_LIQUIDITY,
  description: 'Remove liquidity and claim earned fees from a Uniswap Position.',
  actionCard: UniswapRemoveLiquidityActionCard,
};

export const CLAIM_FEES: Action = {
  id: ActionID.CLAIM_FEES,
  description: 'Claim earned fees from a Uniswap Position.',
  actionCard: UnsiwapClaimFeesActionCard,
};

export const ActionProviders: { [key: string]: ActionProvider } = {
  AloeII: {
    name: 'Aloe II',
    Icon: AloeLogo,
    color: '#3a8d71',
    actions: {
      ADD_MARGIN,
      WITHDRAW,
      BORROW,
      REPAY,
      MINT_TOKEN_PLUS,
      BURN_TOKEN_PLUS,
    },
  },
  UniswapV3: {
    name: 'Uniswap V3',
    Icon: UniswapLogo,
    color: '#f31677',
    actions: {
      ADD_LIQUIDITY,
      REMOVE_LIQUIDITY,
      CLAIM_FEES,
    },
  },
};

export const ActionTemplates: { [key: string]: ActionTemplate } = {
  TEN_X_LEVERAGE: {
    name: 'Classic Borrow',
    description: 'Take out a WETH loan, using interest-bearing USDC+ as collateral.',
    actions: [ADD_MARGIN, MINT_TOKEN_PLUS, BORROW, WITHDRAW],
    defaultActionStates: [
      {
        actionId: ADD_MARGIN.id,
        textFields: [TokenType.ASSET0, '100'],
        aloeResult: null,
        uniswapResult: null,
        operator(_) {
          return null;
        },
      },
      {
        actionId: MINT_TOKEN_PLUS.id,
        textFields: [TokenType.ASSET0, '100'],
        aloeResult: null,
        uniswapResult: null,
        operator(_) {
          return null;
        },
      },
      {
        actionId: BORROW.id,
        textFields: [TokenType.ASSET1, '0.044'],
        aloeResult: null,
        uniswapResult: null,
        operator(_) {
          return null;
        },
      },
      {
        actionId: WITHDRAW.id,
        textFields: [TokenType.ASSET1, '0.044'],
        aloeResult: null,
        uniswapResult: null,
        operator(_) {
          return null;
        },
      },
    ],
  },
  MARKET_MAKING: {
    name: 'Market-Making',
    description: 'Create an in-range Uniswap Position at 20x leverage.',
    actions: [ADD_MARGIN, BORROW, BORROW, ADD_LIQUIDITY],
    defaultActionStates: [
      {
        actionId: ADD_MARGIN.id,
        textFields: [TokenType.ASSET0, '10'],
        aloeResult: null,
        uniswapResult: null,
        operator(_) {
          return null;
        },
      },
      {
        actionId: BORROW.id,
        textFields: [TokenType.ASSET0, '90'],
        aloeResult: null,
        uniswapResult: null,
        operator(_) {
          return null;
        },
      },
      {
        actionId: BORROW.id,
        textFields: [TokenType.ASSET1, '0.0625'],
        aloeResult: null,
        uniswapResult: null,
        operator(_) {
          return null;
        },
      },
      {
        actionId: ADD_LIQUIDITY.id,
        aloeResult: null,
        uniswapResult: null,
        operator(_) {
          return null;
        },
      },
    ],
  },
};

export function getDropdownOptionFromSelectedToken(
  selectedToken: TokenType | null,
  options: DropdownOption[]
): DropdownOption {
  if (options.length === 0) {
    throw new Error();
  }
  return options.find((option: DropdownOption) => option.value === selectedToken) || options[0];
}

export function parseSelectedToken(value: string | undefined): TokenType | null {
  if (!value) return null;
  return value as TokenType;
}

export function calculateHypotheticalStates(
  marginAccount: MarginAccount,
  uniswapPositions: Map<string, UniswapPosition>,
  actionResults: ActionCardState[]
): {
  assets: Assets;
  liabilities: Liabilities;
  positions: Map<string, UniswapPosition>;
}[] {
  const hypotheticalStates: {
    assets: Assets;
    liabilities: Liabilities;
    positions: Map<string, UniswapPosition>;
  }[] = [
    {
      assets: marginAccount.assets,
      liabilities: marginAccount.liabilities,
      positions: deepCopyMap(uniswapPositions),
    },
  ];

  for (let i = 0; i < actionResults.length; i += 1) {
    const actionResult = actionResults[i];

    const assetsTemp = { ...hypotheticalStates[i].assets };
    const liabilitiesTemp = { ...hypotheticalStates[i].liabilities };
    const positionsTemp = deepCopyMap(hypotheticalStates[i].positions);

    // update assets
    assetsTemp.token0Raw += actionResult.aloeResult?.token0RawDelta ?? 0;
    assetsTemp.token1Raw += actionResult.aloeResult?.token1RawDelta ?? 0;
    assetsTemp.token0Plus += actionResult.aloeResult?.token0PlusDelta ?? 0;
    assetsTemp.token1Plus += actionResult.aloeResult?.token1PlusDelta ?? 0;

    if (actionResult.uniswapResult?.uniswapPosition) {
      const [amount0, amount1] = getAmountsForLiquidity(
        actionResult.uniswapResult?.uniswapPosition.liquidity,
        actionResult.uniswapResult?.uniswapPosition.lower,
        actionResult.uniswapResult?.uniswapPosition.upper,
        sqrtRatioToTick(marginAccount.sqrtPriceX96),
        marginAccount.token0.decimals,
        marginAccount.token1.decimals
      );
      assetsTemp.uni0 += amount0;
      assetsTemp.uni1 += amount1;
    }

    // update liabilities
    liabilitiesTemp.amount0 += actionResult.aloeResult?.token0DebtDelta ?? 0;
    liabilitiesTemp.amount1 += actionResult.aloeResult?.token1DebtDelta ?? 0;

    // update positions
    if (actionResult.actionId === ActionID.ADD_LIQUIDITY) {
      const position = actionResult.uniswapResult?.uniswapPosition;
      if (position && position.lower && position.upper) {
        const key = uniswapPositionKey(marginAccount.address, position.lower, position.upper);

        if (positionsTemp.has(key)) {
          const posOldCopy = { ...positionsTemp.get(key)! };
          posOldCopy.liquidity = JSBI.add(posOldCopy.liquidity, position.liquidity);
          positionsTemp.set(key, posOldCopy);
        } else {
          positionsTemp.set(key, { ...position });
        }
      }
    } else if (actionResult.actionId === ActionID.REMOVE_LIQUIDITY) {
      const position = actionResult.uniswapResult?.uniswapPosition;
      if (position && position.lower && position.upper) {
        const key = uniswapPositionKey(marginAccount.address, position.lower, position.upper);

        if (positionsTemp.has(key)) {
          const posOldCopy = { ...positionsTemp.get(key)! };

          if (JSBI.lessThan(posOldCopy.liquidity, position.liquidity)) {
            console.error('Attempted to remove more than 100% of liquidity from a position');
            break;
          }

          posOldCopy.liquidity = JSBI.subtract(posOldCopy.liquidity, position.liquidity);
          positionsTemp.set(key, posOldCopy);
        } else {
          console.error("Attempted to remove liquidity from a position that doens't exist");
          break;
        }
      }
    }

    // if any assets or liabilities are < 0, we have an issue!
    if (Object.values(assetsTemp).find((x) => x < 0) || Object.values(liabilitiesTemp).find((x) => x < 0)) {
      console.log('Margin Account balance dropped below 0!');
      console.log(hypotheticalStates[i]);
      console.log(actionResult);
      break;
    }

    // if the action would cause insolvency, we have an issue!
    // note: Technically (in the contracts) solvency is only checked at the end of a series of actions,
    //       not after each individual one. We tried following that pattern here, but it made the UX
    //       confusing in some cases. For example, with one set of inputs, an entire set of actions would
    //       be highlighted red to show a solvency error. But upon entering a massive value for one of those
    //       actions, the code singles that one out as problematic. In reality solvency is *also* still an issue,
    //       but to the user it looks like they've fixed solvency by entering bogus data in a single action.
    // TLDR: It's simpler to check solvency inside this for loop
    const includeKittyReceipts = assetsTemp.token0Plus > 0 || assetsTemp.token1Plus > 0;
    const solvency = isSolvent(
      {
        ...marginAccount,
        assets: assetsTemp,
        liabilities: liabilitiesTemp,
        includeKittyReceipts,
      },
      Array.from(positionsTemp.values()),
      marginAccount.sqrtPriceX96,
      0.025
    );
    if (!solvency.atA || !solvency.atB) {
      console.log('Margin Account not solvent!');
      console.log(solvency);
      break;
    }

    // otherwise continue accumulating
    hypotheticalStates.push({
      assets: assetsTemp,
      liabilities: liabilitiesTemp,
      positions: positionsTemp,
    });
  }
  return hypotheticalStates;
}
