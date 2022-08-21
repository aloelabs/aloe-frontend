import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import { Display, Text } from '../components/common/Typography';
import {
  ActionProvider,
} from '../components/borrow/ActionCard';
import { MarginAccountCard } from '../components/borrow/MarginAccountCard';
import { GetTokenData } from '../data/TokenData';
import { FeeTier } from '../data/BlendPoolMarkers';
import { NavLink } from 'react-router-dom';

const LEND_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const DEMO_MARGIN_ACCOUNTS = [
  {
    token0: GetTokenData('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
    token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
    feeTier: FeeTier.ZERO_THREE,
  }
];

export default function BorrowAccountsPage() {
  const [activeActions, setActiveActions] = React.useState<
    Array<[ActionProvider, string]>
  >([]);
  const [actionModalOpen, setActionModalOpen] = React.useState(false);
  return (
    <AppPage>
      <div className='mb-4'>
        <Display size='L' weight='semibold'>
          Your Margin Accounts
        </Display>
      </div>
      <div>
        {DEMO_MARGIN_ACCOUNTS.map((marginAccount, index) => (
          <NavLink to='/borrow/account/0'>
            <MarginAccountCard key={index} {...marginAccount} />
          </NavLink>
        ))}
      </div>
    </AppPage>
  );
}
