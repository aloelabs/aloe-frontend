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

export type ActionValue = {
  numericValue: number;
  inputValue: string;
};

export type UniswapPosition = {
  amount0: ActionValue;
  amount1: ActionValue;
  lowerBound: number | null;
  upperBound: number | null;
};

export enum SelectedToken {
  TOKEN_ZERO='TOKEN_ZERO',
  TOKEN_ONE='TOKEN_ONE',
  TOKEN_ZERO_PLUS='TOKEN_ZERO_PLUS',
  TOKEN_ONE_PLUS='TOKEN_ONE_PLUS',
}

export type AloeResult = {
  token0RawDelta: ActionValue;
  token1RawDelta: ActionValue;
  token0DebtDelta: ActionValue;
  token1DebtDelta: ActionValue;
  token0PlusDelta: ActionValue;
  token1PlusDelta: ActionValue;
  selectedToken: SelectedToken | null;
}

export type UniswapResult = {
  uniswapPosition: UniswapPosition;
  slippageTolerance?: ActionValue;
  removeLiquidityPercentage?: ActionValue;
  isToken0Selected?: boolean;
  isAmount0LastUpdated?: boolean;
}

export type ActionCardResult = {
  aloeResult: AloeResult | null;
  uniswapResult: UniswapResult | null;
}

export type CumulativeActionCardResult = {
  aloeResult: AloeResult | null;
  uniswapPositions: UniswapPosition[];
}

export type ActionCardProps = {
  token0: TokenData;
  token1: TokenData;
  feeTier: FeeTier;
  previousActionCardState: ActionCardResult | null;
  onRemove: () => void;
  onChange: (result: ActionCardResult) => void;
};

export type Action = {
  name: string;
  actionCard: React.FC<ActionCardProps>;
}

export type ActionProvider = {
  name: string;
  Icon: React.FC;
  color: string;
  actions: {
    [key: string]: Action;
  };
};


export type ActionTemplate = {
  name: string,
  actions: Array<Action>,
  defaultActionResults?: Array<ActionCardResult>, 
}

export const DEFAULT_ACTION_VALUE: ActionValue = {
  numericValue: 0,
  inputValue: '',
}

export const MINT_TOKEN_PLUS: Action = {
  name: 'Mint Token+',
  actionCard: AloeMintTokenPlusActionCard,
}

export const BURN_TOKEN_PLUS: Action = {
  name: 'Burn Token+',
  actionCard: AloeBurnTokenPlusActionCard,
}

export const BORROW: Action = {
  name: 'Borrow',
  actionCard: AloeBorrowActionCard,
}

export const REPAY: Action = {
  name: 'Repay',
  actionCard: AloeRepayActionCard,
}

export const WITHDRAW: Action = {
  name: 'Withdraw',
  actionCard: AloeWithdrawActionCard,
}

export const ADD_MARGIN: Action = {
  name: 'Add Margin',
  actionCard: AloeAddMarginActionCard,
}

export const REMOVE_LIQUIDITY: Action = {
  name: 'Remove Liquidity',
  actionCard: UniswapRemoveLiquidityActionCard,
}

export const ADD_LIQUIDITY: Action = {
  name: 'Add Liquidity',
  actionCard: UniswapAddLiquidityActionCard,
}

export const ActionProviders = {
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

export const ActionTemplates = {
  TEN_X_LEVERAGE: {
    name: '10x Leverage',
    actions: [
      ADD_MARGIN,
      BORROW,
      ADD_LIQUIDITY,
    ],
    defaultActionResults: [
      {
        aloeResult: {
          token0RawDelta: {
            numericValue: 10,
            inputValue: '10.0',
          },
          token1RawDelta: DEFAULT_ACTION_VALUE,
          token0DebtDelta: DEFAULT_ACTION_VALUE,
          token1DebtDelta: DEFAULT_ACTION_VALUE,
          token0PlusDelta: DEFAULT_ACTION_VALUE,
          token1PlusDelta: DEFAULT_ACTION_VALUE,
          selectedToken: null,
        },
        uniswapResult: null,
      },
      {
        aloeResult: {
          token0RawDelta: DEFAULT_ACTION_VALUE,
          token1RawDelta: DEFAULT_ACTION_VALUE,
          token0DebtDelta: DEFAULT_ACTION_VALUE,
          token1DebtDelta: DEFAULT_ACTION_VALUE,
          token0PlusDelta: {
            numericValue: 10,
            inputValue: '10.0',
          },
          token1PlusDelta: DEFAULT_ACTION_VALUE,
          selectedToken: null,
        },
        uniswapResult: null,
      },
      {
        aloeResult: {
          token0RawDelta: DEFAULT_ACTION_VALUE,
          token1RawDelta: {
            numericValue: 10,
            inputValue: '10.0',
          },
          token0DebtDelta: DEFAULT_ACTION_VALUE,
          token1DebtDelta: DEFAULT_ACTION_VALUE,
          token0PlusDelta: DEFAULT_ACTION_VALUE,
          token1PlusDelta: DEFAULT_ACTION_VALUE,
          selectedToken: null,
        },
        uniswapResult: null,
      },
    ]
  }
}

export function getDropdownOptionFromSelectedToken(selectedToken: SelectedToken | null, options: DropdownOption[]): DropdownOption {
  if (options.length === 0) {
    throw new Error();
  }
  return options.find((option: DropdownOption) => option.value === selectedToken) || options[0];
}

export function parseSelectedToken(value: string | undefined): SelectedToken | null {
  if (!value) return null;
  return value as SelectedToken;
}