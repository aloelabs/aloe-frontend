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
import { Assets, Liabilities, MarginAccount } from '../MarginAccount';
import { UserBalances } from '../UserBalances';
import { ActionID } from './ActionID';
import { runWithChecks } from './Utils';

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

export interface AccountState {
  readonly assets: Assets;
  readonly liabilities: Liabilities;
  readonly uniswapPositions: readonly UniswapPosition[];
  readonly availableBalances: UserBalances;
  readonly requiredAllowances: UserBalances;
  readonly claimedFeeUniswapKeys: readonly string[];
}

type Operator = (state: AccountState) => AccountState | null;

export type ActionCardOutput = {
  actionId: ActionID;
  actionArgs?: string;
  operator: Operator;
};

export type ActionCardProps = {
  /** holds values that don't change across actions, like account address and token data */
  marginAccount: Omit<MarginAccount, 'assets' | 'liabilities'>;
  /** holds values that do change across actions, like assets and liabilities */
  accountState: AccountState;
  /**
   * fields that are used to (a) create ActionCards from templates and (b) restore
   * ActionCards when another is deleted (indices change and React loses track of state)
   */
  userInputFields?: string[];
  /** whether the action is causing an error and should be given a red border */
  isCausingError: boolean;
  /** should be set to true if ActionCard is being created from a template */
  forceOutput: boolean;
  /** called whenever the ActionCard's output changes */
  onChange: (output: ActionCardOutput, userInputFields: string[]) => void;
  /** removes the ActionCard */
  onRemove: () => void;
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
  userInputFields?: (string[] | undefined)[];
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
    name: 'Uni V3',
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
    userInputFields: [
      [TokenType.ASSET0, '100'],
      [TokenType.ASSET0, '100'],
      [TokenType.ASSET1, '0.044'],
      [TokenType.ASSET1, '0.044'],
    ],
  },
  MARKET_MAKING: {
    name: 'Market-Making',
    description: 'Create an in-range Uniswap Position at 20x leverage.',
    actions: [ADD_MARGIN, BORROW, BORROW, ADD_LIQUIDITY],
    userInputFields: [[TokenType.ASSET0, '10'], [TokenType.ASSET0, '90'], [TokenType.ASSET1, '0.0625'], undefined],
  },
};

export function getDropdownOptionFromSelectedToken(
  selectedToken: TokenType | null,
  options: DropdownOption<TokenType>[]
): DropdownOption<TokenType> {
  if (options.length === 0) {
    throw new Error();
  }
  return options.find((option: DropdownOption<TokenType>) => option.value === selectedToken) || options[0];
}

export function calculateHypotheticalStates(
  marginAccount: Omit<MarginAccount, 'assets' | 'liabilities'>,
  initialState: AccountState,
  operators: Operator[]
): AccountState[] {
  const states: AccountState[] = [initialState];

  for (let i = 0; i < operators.length; i += 1) {
    const state = runWithChecks(operators[i], states[i], marginAccount);
    if (state == null) break;

    states.push(state);
  }

  return states;
}
