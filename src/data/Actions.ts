import { ReactComponent as AloeLogo } from '../assets/svg/aloe_capital_logo.svg';
import { ReactComponent as UniswapLogo } from '../assets/svg/uniswap_logo.svg';
import { AloeBorrowActionCard } from '../components/borrow/actions/AloeBorrowActionCard';
import { AloeDepositActionCard } from '../components/borrow/actions/AloeDepositActionCard';
import { AloeRepayActionCard } from '../components/borrow/actions/AloeRepayActionCard';
import { AloeWithdrawActionCard } from '../components/borrow/actions/AloeWithdrawActionCard';
import { DropdownOption } from '../components/common/Dropdown';
import { TokenData } from './TokenData';

export const Actions = {
  AloeII: {
    name: 'Aloe II',
    Icon: AloeLogo,
    color: '#63b59a',
    actions: {
      DEPOSIT: {
        name: 'Deposit',
        actionCard: AloeDepositActionCard,
      },
      WITHDRAW: {
        name: 'Withdraw',
        actionCard: AloeWithdrawActionCard,
      },
      BORROW: {
        name: 'Borrow',
        actionCard: AloeBorrowActionCard,
      },
      REPAY: {
        name: 'Repay',
        actionCard: AloeRepayActionCard,
      }
    },
  },
};

export type UniswapPosition = {
  liquidity: number;
  lowerBound: number;
  upperBound: number;
};

export type ActionCardResult = {
  token0RawDelta: string;
  token1RawDelta: string;
  token0DebtDelta: string;
  token1DebtDelta: string;
  token0PlusDelta: string;
  token1PlusDelta: string;
  uniswapPositions: UniswapPosition[];
  selectedTokenA: DropdownOption | null;
  selectedTokenB: DropdownOption | null;
};

export type ActionCardProps = {
  token0: TokenData | null;
  token1: TokenData | null;
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
    [key: string]: {
      name: string;
      actionCard: React.FC<ActionCardProps>;
    }
  };
};
