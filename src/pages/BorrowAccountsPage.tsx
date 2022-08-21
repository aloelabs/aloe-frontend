import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import { Display, Text } from '../components/common/Typography';
import { MarginAccountCard } from '../components/borrow/MarginAccountCard';
import { GetTokenData } from '../data/TokenData';
import { FeeTier } from '../data/BlendPoolMarkers';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import { FilledGradientButtonWithIcon } from '../components/common/Buttons';

const DEMO_MARGIN_ACCOUNTS = [
  {
    token0: GetTokenData('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
    token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
    feeTier: FeeTier.ZERO_THREE,
  }
];

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
      <div>
        {DEMO_MARGIN_ACCOUNTS.map((marginAccount, index) => (
          <MarginAccountCard key={index} {...marginAccount} />
        ))}
      </div>
    </AppPage>
  );
}
