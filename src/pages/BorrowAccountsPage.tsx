import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import { Display, Text } from '../components/common/Typography';
import { MarginAccountCard } from '../components/borrow/MarginAccountCard';
import { GetTokenData } from '../data/TokenData';
import { FeeTier } from '../data/FeeTier';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import { FilledGradientButtonWithIcon } from '../components/common/Buttons';

const DEMO_MARGIN_ACCOUNTS = [
  {
    token0: GetTokenData('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
    token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
    feeTier: FeeTier.ZERO_ZERO_FIVE,
    id: '1234',
  },
  {
    token0: GetTokenData('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'),
    token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
    feeTier: FeeTier.ZERO_ZERO_FIVE,
    id: '5678',
  },
];

const MarginAccountsContainner = styled.div`
  ${tw`flex items-center justify-start flex-wrap gap-4`}
`;

export default function BorrowAccountsPage() {
  return (
    <AppPage>
      <div className='flex gap-8 items-center mb-4'>
        <Display size='L' weight='semibold'>
          Your Margin Accounts
        </Display>
        <FilledGradientButtonWithIcon
          Icon={<PlusIcon />}
          position='leading'
          size='S'
          svgColorType='stroke'
          onClick={() => {}}
        >
          New
        </FilledGradientButtonWithIcon>
      </div>
      <MarginAccountsContainner>
        {DEMO_MARGIN_ACCOUNTS.map((marginAccount, index) => (
          <MarginAccountCard key={index} {...marginAccount} />
        ))}
      </MarginAccountsContainner>
    </AppPage>
  );
}
