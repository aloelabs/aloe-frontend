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
    token0: GetTokenData('0x3c80ca907ee39f6c3021b66b5a55ccc18e07141a'),
    token1: GetTokenData('0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6'),
    feeTier: FeeTier.ZERO_ZERO_FIVE,
    id: '1234',
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
