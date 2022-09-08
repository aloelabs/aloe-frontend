import { ReactComponent as AloeLogo } from '../assets/svg/aloe_capital_logo.svg';
import { ReactComponent as UniswapLogo } from '../assets/svg/uniswap_logo.svg';
import { AloeBorrowActionCard } from '../components/borrow/actions/AloeBorrowActionCard';
import { AloeMintTokenPlusActionCard } from '../components/borrow/actions/AloeMintTokenPlusActionCard';
import { AloeRepayActionCard } from '../components/borrow/actions/AloeRepayActionCard';
import { AloeWithdrawActionCard } from '../components/borrow/actions/AloeWithdrawActionCard';
import { AloeAddMarginActionCard } from '../components/borrow/actions/AloeAddMarginActionCard';
import { AloeBurnTokenPlusActionCard } from '../components/borrow/actions/AloeBurnTokenPlusActionCard';
import UniswapAddLiquidityActionCard from '../components/borrow/actions/UniswapAddLiquidityActionCard';
import UniswapRemoveLiquidityActionCard from '../components/borrow/actions/UniswapRemoveLiquidityActionCard';
import { DropdownOption } from '../components/common/Dropdown';
import { FeeTier } from './FeeTier';
import { TokenData } from './TokenData';
import JSBI from 'jsbi';
import { Assets, Liabilities } from './MarginAccount';

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
  amount0: number;
  amount1: number;
  lowerBound: number | null;
  upperBound: number | null;
  liquidity: JSBI;
};

export enum SelectedToken {
  TOKEN_ZERO = 'TOKEN_ZERO',
  TOKEN_ONE = 'TOKEN_ONE',
  TOKEN_ZERO_PLUS = 'TOKEN_ZERO_PLUS',
  TOKEN_ONE_PLUS = 'TOKEN_ONE_PLUS',
}

export type AloeResult = {
  token0RawDelta?: number;
  token1RawDelta?: number;
  token0DebtDelta?: number;
  token1DebtDelta?: number;
  token0PlusDelta?: number;
  token1PlusDelta?: number;
  selectedToken: SelectedToken | null;
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
  error?: boolean;
  errorMsg?: string;
  aloeResult: AloeResult | null;
  uniswapResult: UniswapResult | null;
};

export type CumulativeActionCardResult = {
  aloeResult: AloeResult | null;
  uniswapPositions: UniswapPosition[];
};

export type ActionCardProps = {
  token0: TokenData;
  token1: TokenData;
  kitty0: TokenData;
  kitty1: TokenData;
  feeTier: FeeTier;
  previousActionCardState: ActionCardState | null;
  isCausingError: boolean;
  onRemove: () => void;
  onChange: (result: ActionCardState) => void;
};

export type Action = {
  id: ActionID;
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
  actions: Array<Action>;
  defaultActionStates?: Array<ActionCardState>;
};

export const MINT_TOKEN_PLUS: Action = {
  id: ActionID.MINT,
  actionCard: AloeMintTokenPlusActionCard,
};

export const BURN_TOKEN_PLUS: Action = {
  id: ActionID.BURN,
  actionCard: AloeBurnTokenPlusActionCard,
};

export const BORROW: Action = {
  id: ActionID.BORROW,
  actionCard: AloeBorrowActionCard,
};

export const REPAY: Action = {
  id: ActionID.REPAY,
  actionCard: AloeRepayActionCard,
};

export const WITHDRAW: Action = {
  id: ActionID.TRANSFER_OUT,
  actionCard: AloeWithdrawActionCard,
};

export const ADD_MARGIN: Action = {
  id: ActionID.TRANSFER_IN,
  actionCard: AloeAddMarginActionCard,
};

export const REMOVE_LIQUIDITY: Action = {
  id: ActionID.REMOVE_LIQUIDITY,
  actionCard: UniswapRemoveLiquidityActionCard,
};

export const ADD_LIQUIDITY: Action = {
  id: ActionID.ADD_LIQUIDITY,
  actionCard: UniswapAddLiquidityActionCard,
};

export const ActionProviders: { [key: string]: ActionProvider } = {
  AloeII: {
    name: 'Aloe II',
    Icon: AloeLogo,
    color: '#63b59a',
    actions: {
      MINT_TOKEN_PLUS,
      BURN_TOKEN_PLUS,
      BORROW,
      REPAY,
      WITHDRAW,
      ADD_MARGIN,
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
    name: '10x Leverage',
    actions: [ADD_MARGIN, BORROW, ADD_LIQUIDITY],
    defaultActionStates: [
      {
        actionId: ADD_MARGIN.id,
        textFields: ['10'],
        aloeResult: {
          token0RawDelta: 10,
          selectedToken: SelectedToken.TOKEN_ZERO,
        },
        uniswapResult: null,
      },
      {
        actionId: BORROW.id,
        textFields: ['100'],
        aloeResult: {
          token0RawDelta: 100,
          token0DebtDelta: 100,
          selectedToken: SelectedToken.TOKEN_ZERO,
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
  MARKET_MAKING: {
    name: 'Market-Making',
    actions: [ADD_MARGIN, BORROW, BORROW, ADD_LIQUIDITY],
    defaultActionStates: [
      {
        actionId: ADD_MARGIN.id,
        textFields: ['10'],
        aloeResult: {
          token0RawDelta: 10,
          selectedToken: SelectedToken.TOKEN_ZERO,
        },
        uniswapResult: null,
      },
      {
        actionId: BORROW.id,
        textFields: ['50'],
        aloeResult: {
          token0RawDelta: 50,
          token0DebtDelta: 50,
          selectedToken: SelectedToken.TOKEN_ZERO,
        },
        uniswapResult: null,
      },
      {
        actionId: BORROW.id,
        textFields: ['0.03'],
        aloeResult: {
          token1RawDelta: 0.03,
          token1DebtDelta: 0.03,
          selectedToken: SelectedToken.TOKEN_ONE,
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
  selectedToken: SelectedToken | null,
  options: DropdownOption[]
): DropdownOption {
  if (options.length === 0) {
    throw new Error();
  }
  return (
    options.find((option: DropdownOption) => option.value === selectedToken) ||
    options[0]
  );
}

export function parseSelectedToken(
  value: string | undefined
): SelectedToken | null {
  if (!value) return null;
  return value as SelectedToken;
}

export function calculateHypotheticalState(
  assetsI: Assets,
  liabilitiesI: Liabilities,
  actionResults: ActionCardState[],
): {
  assetsF: Assets,
  liabilitiesF: Liabilities,
  problematicActionIdx: number,
} {
  let assetsF = {...assetsI};
  let liabilitiesF = {...liabilitiesI};
  let problematicActionIdx = -1;
  for (let i = 0; i < actionResults.length; i += 1) {
    const actionResult = actionResults[i];

    const assetsTemp = { ...assetsF };
    const liabilitiesTemp = { ...liabilitiesF };

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

    // if any assets or liabilities are < 0, we have an issue!
    if (Object.values(assetsTemp).find((x) => x < 0) || Object.values(liabilitiesTemp).find((x) => x < 0)) {
      problematicActionIdx = i;
      break;
    }

    // otherwise continue accumulating
    assetsF = assetsTemp;
    liabilitiesF = liabilitiesTemp;
  }
  return {
    assetsF,
    liabilitiesF,
    problematicActionIdx,
  }
}
