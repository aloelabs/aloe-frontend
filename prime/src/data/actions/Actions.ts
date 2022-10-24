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
import { uniswapPositionKey } from '../../util/Uniswap';
import { Assets, isSolvent, Liabilities, MarginAccount } from '../MarginAccount';
import { UserBalances } from '../UserBalances';
import { ActionID } from './ActionID';

export type UniswapPosition = {
  readonly liquidity: JSBI;
  readonly lower: number;
  readonly upper: number;
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

export interface ActionCardOperand {
  readonly assets: Assets;
  readonly liabilities: Liabilities;
  readonly uniswapPositions: readonly UniswapPosition[]; //Map<string, UniswapPosition>;
  readonly availableBalances: UserBalances;
  readonly requiredAllowances: UserBalances;
}

export interface ActionCardOutput<T> {
  updatedOperand?: ActionCardOperand;
  fields: T;
  actionArgs?: string;
}

export type ActionCardProps<T> = {
  marginAccount: Omit<MarginAccount, 'assets' | 'liabilities'>;
  operand?: ActionCardOperand;
  fields: T;
  onChange: (output: ActionCardOutput<T>) => void;
  onRemove: () => void;
};

export type Action = {
  id: ActionID;
  description: string;
  actionCard: React.FC<ActionCardProps<any>>;
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
        aloeResult: { selectedToken: TokenType.ASSET0 },
        uniswapResult: null,
      },
      {
        actionId: MINT_TOKEN_PLUS.id,
        textFields: ['100'],
        aloeResult: { selectedToken: TokenType.ASSET0 },
        uniswapResult: null,
      },
      {
        actionId: BORROW.id,
        textFields: ['0.044'],
        aloeResult: { selectedToken: TokenType.ASSET1 },
        uniswapResult: null,
      },
      {
        actionId: WITHDRAW.id,
        textFields: ['0.044'],
        aloeResult: { selectedToken: TokenType.ASSET1 },
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
  options: DropdownOption[]
): DropdownOption {
  if (options.length === 0) {
    throw new Error();
  }
  return options.find((option: DropdownOption) => option.value === selectedToken) || options[0];
}
