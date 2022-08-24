import { ReactComponent as AloeLogo } from '../assets/svg/aloe_capital_logo.svg';
import { ReactComponent as UniswapLogo } from '../assets/svg/uniswap_logo.svg';
import { AloeDepositActionCard } from '../components/borrow/actions/AloeDepositActionCard';
import { AloeWithdrawActionCard } from '../components/borrow/actions/AloeWithdrawActionCard';
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
    },
  },
};

export type UniswapPosition = {
  liquidity: number;
  lowerBound: number;
  upperBound: number;
};

export type ActionCardResult = {
  token0RawDelta: number;
  token1RawDelta: number;
  token0DebtDelta: number;
  token1DebtDelta: number;
  token0PlusDelta: number;
  token1PlusDelta: number;
  uniswapPositions: UniswapPosition[];
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
