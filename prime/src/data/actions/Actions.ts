import JSBI from 'jsbi';
import { DropdownOption } from 'shared/lib/components/common/Dropdown';

import { ReactComponent as AloeLogo } from '../../assets/svg/aloe_capital_logo.svg';
import { ReactComponent as UniswapLogo } from '../../assets/svg/uniswap_logo.svg';
import { AloeAddMarginActionCard } from '../../components/borrow/actions/AloeAddMarginActionCard';
import { AloeBorrowActionCard } from '../../components/borrow/actions/AloeBorrowActionCard';
import { AloeRepayActionCard } from '../../components/borrow/actions/AloeRepayActionCard';
import { AloeWithdrawActionCard } from '../../components/borrow/actions/AloeWithdrawActionCard';
import UniswapAddLiquidityActionCard from '../../components/borrow/actions/UniswapAddLiquidityActionCard';
import UnsiwapClaimFeesActionCard from '../../components/borrow/actions/UniswapClaimFeesActionCard';
import UniswapRemoveLiquidityActionCard from '../../components/borrow/actions/UniswapRemoveLiquidityActionCard';
import UniswapSwapActionCard from '../../components/borrow/actions/UniswapSwapActionCard';
import { Balances } from '../Balances';
import { Assets, Liabilities, MarginAccount } from '../MarginAccount';
import { MarketInfo } from '../MarketInfo';
import { ActionID } from './ActionID';
import { runWithChecks } from './Utils';

export type UniswapPosition = {
  lower: number;
  upper: number;
  liquidity: JSBI;
};

export type UniswapPositionPrior = Omit<UniswapPosition, 'liquidity'>;

export enum TokenType {
  ASSET0 = 'ASSET0',
  ASSET1 = 'ASSET1',
}

export interface AccountState {
  readonly assets: Assets;
  readonly liabilities: Liabilities;
  readonly uniswapPositions: readonly UniswapPosition[];
  readonly availableForDeposit: Balances;
  readonly availableForBorrow: Balances;
  readonly requiredAllowances: Balances;
  readonly claimedFeeUniswapKeys: readonly string[];
}

export type HypotheticalAccountStates = {
  accountStates: AccountState[];
  errorMsg?: string;
};

type Operator = (state: AccountState) => AccountState;

export type ActionCardOutput = {
  actionId: ActionID;
  actionArgs?: string;
  operator: Operator;
};

export type ActionCardProps = {
  /** properties of the market as a whole, not specific to the Borrower */
  marketInfo: MarketInfo;
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
  /** an error message to display if the action is causing an error */
  errorMsg?: string;
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
  isLocal: boolean;
  actions: Array<Action>;
  userInputFields?: (string[] | undefined)[];
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
  description: 'Send funds from your Borrow Vault to your wallet.',
  actionCard: AloeWithdrawActionCard,
};

export const ADD_MARGIN: Action = {
  id: ActionID.TRANSFER_IN,
  description: 'Send funds from your wallet to your Borrow Vault. You must do this before anything else.',
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

export const SWAP: Action = {
  id: ActionID.SWAP,
  description: 'Swap tokens on Uniswap.',
  actionCard: UniswapSwapActionCard,
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
      SWAP,
    },
  },
};

export const ActionTemplates: { [key: string]: ActionTemplate } = {
  // TEN_X_LEVERAGE: {
  //   name: 'Classic Borrow',
  //   description: 'Take out a WETH loan, using interest-bearing USDC+ as collateral.',
  //   actions: [ADD_MARGIN, BORROW, WITHDRAW],
  //   userInputFields: [
  //     [TokenType.ASSET0, '100'],
  //     [TokenType.ASSET1, '0.044'],
  //     [TokenType.ASSET1, '0.044'],
  //   ],
  // },
  MARKET_MAKING: {
    name: 'Market-Making',
    description: 'Create an in-range Uniswap Position at 20x leverage.',
    isLocal: false,
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
): HypotheticalAccountStates {
  const accountStates: AccountState[] = [initialState];
  let errorMsg: string | undefined = undefined;

  for (let i = 0; i < operators.length; i += 1) {
    try {
      const accountState = runWithChecks(operators[i], accountStates[i], marginAccount);
      accountStates.push(accountState);
    } catch (e) {
      errorMsg = (e as Error).message;
      // Replace TokenType enums with actual token symbols
      errorMsg = errorMsg.replace(TokenType.ASSET0, marginAccount.token0.symbol);
      errorMsg = errorMsg.replace(TokenType.ASSET1, marginAccount.token1.symbol);
      break;
    }
  }
  return {
    accountStates,
    errorMsg,
  };
}

export function getAction(id: ActionID): Action {
  switch (id) {
    case ActionID.TRANSFER_IN:
      return ADD_MARGIN;
    case ActionID.TRANSFER_OUT:
      return WITHDRAW;
    case ActionID.BORROW:
      return BORROW;
    case ActionID.REPAY:
      return REPAY;
    case ActionID.ADD_LIQUIDITY:
      return ADD_LIQUIDITY;
    case ActionID.REMOVE_LIQUIDITY:
      return REMOVE_LIQUIDITY;
    case ActionID.CLAIM_FEES:
      return CLAIM_FEES;
    case ActionID.SWAP:
      return SWAP;
    default:
      return ADD_MARGIN;
  }
}
