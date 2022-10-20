import JSBI from 'jsbi';
import { DropdownOption } from 'shared/lib/components/common/Dropdown';

import { ReactComponent as AloeLogo } from '../assets/svg/aloe_capital_logo.svg';
import { ReactComponent as UniswapLogo } from '../assets/svg/uniswap_logo.svg';
import { AloeAddMarginActionCard } from '../components/borrow/actions/AloeAddMarginActionCard';
import { AloeBorrowActionCard } from '../components/borrow/actions/AloeBorrowActionCard';
import { AloeBurnTokenPlusActionCard } from '../components/borrow/actions/AloeBurnTokenPlusActionCard';
import { AloeMintTokenPlusActionCard } from '../components/borrow/actions/AloeMintTokenPlusActionCard';
import { AloeRepayActionCard } from '../components/borrow/actions/AloeRepayActionCard';
import { AloeWithdrawActionCard } from '../components/borrow/actions/AloeWithdrawActionCard';
import UniswapAddLiquidityActionCard from '../components/borrow/actions/UniswapAddLiquidityActionCard';
import UniswapRemoveLiquidityActionCard from '../components/borrow/actions/UniswapRemoveLiquidityActionCard';
import { deepCopyMap } from '../util/Maps';
import { uniswapPositionKey } from '../util/Uniswap';
import { Assets, isSolvent, Liabilities, MarginAccount } from './MarginAccount';
import { UserBalances } from './UserBalances';

export enum ActionID {
  TRANSFER_IN,
  TRANSFER_OUT,
  MINT,
  BURN,
  BORROW,
  REPAY,
  ADD_LIQUIDITY,
  REMOVE_LIQUIDITY,
  SWAP,
}

export function getNameOfAction(id: ActionID): string {
  switch (id) {
    case ActionID.TRANSFER_IN:
      return 'Add Margin';
    case ActionID.TRANSFER_OUT:
      return 'Withdraw';
    case ActionID.MINT:
      return 'Mint Token+';
    case ActionID.BURN:
      return 'Burn Token+';
    case ActionID.BORROW:
      return 'Borrow';
    case ActionID.REPAY:
      return 'Repay';
    case ActionID.ADD_LIQUIDITY:
      return 'Add Liquidity';
    case ActionID.REMOVE_LIQUIDITY:
      return 'Remove Liquidity';
    default:
      return 'UNKNOWN';
  }
}

// export type ActionValue = number;

export type UniswapPosition = {
  amount0?: number;
  amount1?: number;
  lower: number | null;
  upper: number | null;
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

export type ActionCardState = {
  actionId: ActionID;
  actionArgs?: string;
  textFields?: string[];
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

export const REMOVE_LIQUIDITY: Action = {
  id: ActionID.REMOVE_LIQUIDITY,
  description: 'Remove liquidity from a Uniswap Position.',
  actionCard: UniswapRemoveLiquidityActionCard,
};

export const ADD_LIQUIDITY: Action = {
  id: ActionID.ADD_LIQUIDITY,
  description: 'Create a new Uniswap Position or add liquidity to an existing one.',
  actionCard: UniswapAddLiquidityActionCard,
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
        textFields: ['100'],
        aloeResult: {
          selectedToken: TokenType.ASSET0,
        },
        uniswapResult: null,
      },
      {
        actionId: MINT_TOKEN_PLUS.id,
        textFields: ['100'],
        aloeResult: {
          selectedToken: TokenType.ASSET0,
        },
        uniswapResult: null,
      },
      {
        actionId: BORROW.id,
        textFields: ['0.044'],
        aloeResult: {
          selectedToken: TokenType.ASSET1,
        },
        uniswapResult: null,
      },
      {
        actionId: WITHDRAW.id,
        textFields: ['0.044'],
        aloeResult: {
          selectedToken: TokenType.ASSET1,
        },
        uniswapResult: null,
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
        textFields: ['10'],
        aloeResult: {
          token0RawDelta: 10,
          selectedToken: TokenType.ASSET0,
        },
        uniswapResult: null,
      },
      {
        actionId: BORROW.id,
        textFields: ['90'],
        aloeResult: {
          token0RawDelta: 90,
          token0DebtDelta: 90,
          selectedToken: TokenType.ASSET0,
        },
        uniswapResult: null,
      },
      {
        actionId: BORROW.id,
        textFields: ['0.0625'],
        aloeResult: {
          token1RawDelta: 0.0625,
          token1DebtDelta: 0.0625,
          selectedToken: TokenType.ASSET1,
        },
        uniswapResult: null,
      },
      {
        actionId: ADD_LIQUIDITY.id,
        aloeResult: null,
        uniswapResult: null,
      },
    ],
  },
};

export function getDropdownOptionFromSelectedToken(
  selectedToken: TokenType | null,
  options: DropdownOption[],
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
  actionResults: ActionCardState[],
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
    assetsTemp.uni0 += actionResult.uniswapResult?.uniswapPosition.amount0 ?? 0;
    assetsTemp.uni1 += actionResult.uniswapResult?.uniswapPosition.amount1 ?? 0;

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
      0.025,
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
