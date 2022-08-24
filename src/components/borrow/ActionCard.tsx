import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Display, Text } from '../common/Typography';
import { ReactComponent as AloeLogo } from '../../assets/svg/aloe_capital_logo.svg';
import { ReactComponent as UniswapLogo } from '../../assets/svg/uniswap_logo.svg';
import { ReactComponent as CloseModal } from '../../assets/svg/close_modal.svg';
import { GetTokenData, TokenData } from '../../data/TokenData';
import { FilledGreyButton } from '../common/Buttons';
import { AloeDepositAction, AloeWithdrawAction } from './actions/SingleNumericEntry';
import { FeeTier } from '../../data/BlendPoolMarkers';

export const UNISWAP_V3_PAIRS = [
  {
    name: 'USDC/WETH',
    token0: GetTokenData('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
    token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
  },
  {
    name: 'WBTC/WETH',
    token0: GetTokenData('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'),
    token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
  }
];

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

export const Actions = {
  AloeII: {
    name: 'Aloe II',
    Icon: AloeLogo,
    color: '#63b59a',
    actions: {
      DEPOSIT: {
        name: 'Deposit',
        actionCard: AloeDepositAction,
      },
      WITHDRAW: {
        name: 'Withdraw',
        actionCard: AloeWithdrawAction,
      },
    },
  },
  // UniswapV3: {
  //   name: 'Uniswap V3',
  //   Icon: UniswapLogo,
  //   color: '#FF007A',
  //   actions: ['Swap Token', 'Add Liquidity', 'Remove Liquidity'],
  // },
};

const ActionCardContainer = styled.div`
  ${tw`flex flex-col items-center justify-center`}
  width: 400px;
  padding: 12px 24px;
  border-radius: 8px;
  background-color: rgba(13, 24, 33, 1);
  border: 1px solid rgba(34, 54, 69, 1);
`;

const ActionBadge = styled.div.attrs(
  (props: { backgroundColor: string }) => props
)`
  ${tw`flex items-center justify-center`}
  width: max-width;
  padding: 12px 8px;
  border-radius: 8px;
  background-color: ${(props) => props.backgroundColor};
`;

const SvgWrapper = styled.div`
  ${tw`flex items-center justify-center`}
  width: 32px;
  height: 32px;

  svg {
    width: 32px;
    height: 32px;
  }
`;

export type BaseActionCardProps = {
  actionProvider: ActionProvider;
  action: string;
  children: React.ReactNode;
  onRemove: () => void;
};

export function BaseActionCard(props: BaseActionCardProps) {
  const { actionProvider, action, children, onRemove } = props;
  return (
    <ActionCardContainer>
      <div className='w-full flex justify-start items-center gap-4 mb-4'>
        <ActionBadge backgroundColor={actionProvider.color}>
          <Text size='S' weight='medium'>
            {action}
          </Text>
        </ActionBadge>
        <div className='flex items-center'>
          <SvgWrapper>
            <actionProvider.Icon />
          </SvgWrapper>
          <Display size='S'>{actionProvider.name}</Display>
        </div>
        <button type='button' title='Remove' className='ml-auto'>
          <SvgWrapper>
            <CloseModal onClick={onRemove} />
          </SvgWrapper>
        </button>
      </div>
      {children}
    </ActionCardContainer>
  );
}
