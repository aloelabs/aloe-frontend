import { useState } from 'react';

import AppPage from 'shared/lib/components/common/AppPage';
import { OutlinedWhiteButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { MultiDropdownOption } from 'shared/lib/components/common/Dropdown';
import { ItemsPerPage } from 'shared/lib/components/common/Pagination';
import { Text, Display } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

import { ReactComponent as DollarIcon } from '../assets/svg/dollar.svg';
import { ReactComponent as SendIcon } from '../assets/svg/send.svg';
import { ReactComponent as ShareIcon } from '../assets/svg/share.svg';
import { ReactComponent as TrendingUpIcon } from '../assets/svg/trending_up.svg';
import WelcomeModal from '../components/lend/modal/WelcomeModal';
import AssetBar from '../components/portfolio/AssetBar';
import LendingPairPeerCard from '../components/portfolio/LendingPairPeerCard';
import PortfolioGrid from '../components/portfolio/PortfolioGrid';
import { RESPONSIVE_BREAKPOINT_XS } from '../data/constants/Breakpoints';
import { LendingPair, LendingPairBalances } from '../data/LendingPair';
import { GetTokenData, getTokens, TokenData } from '../data/TokenData';

const FAKE_DATA = [
  {
    token: GetTokenData('0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6'),
    percentage: 0.5,
    color: 'rgb(140,140,140)',
  },
  {
    token: GetTokenData('0xad5efe0d12c1b3fe87a171c83ce4cca4d85d381a'),
    percentage: 0.4,
    color: 'rgb(40, 120, 200)',
  },
  {
    token: GetTokenData('0x886055958cdf2635ff47a2071264a3413d26f959'),
    percentage: 0.1,
    color: 'rgb(239, 147, 0)',
  },
];

const WELCOME_MODAL_LOCAL_STORAGE_KEY = 'acknowledged-welcome-modal-lend';
const WELCOME_MODAL_LOCAL_STORAGE_VALUE = 'acknowledged';

const LEND_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const Container = styled.div`
  max-width: 900px;
  margin: 0 auto;
`;

const LendHeaderContainer = styled.div`
  display: grid;
  grid-template-columns: 3fr 2fr;
  height: 300px;
`;

const LendHeader = styled.div`
  ${tw`flex flex-col justify-between`}
`;

const LowerLendHeader = styled.div`
  display: flex;
  align-items: center;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    flex-direction: column-reverse;
    align-items: flex-start;
  }
`;

const LendCards = styled.div`
  ${tw`flex flex-col`}
  row-gap: 24px;
  margin-top: 24px;
`;

export type TokenQuote = {
  token: TokenData;
  price: number;
};

export type TokenBalance = {
  token: TokenData;
  balance: number;
  balanceUSD: number;
  isKitty: boolean;
  apy: number;
  pairName: string;
};

const filterOptions: MultiDropdownOption[] = getTokens().map((token) => {
  return {
    value: token.address,
    label: token.ticker,
    icon: token.iconPath,
  } as MultiDropdownOption;
});

export default function PortfolioPage() {
  // MARK: component state
  const [tokenQuotes, setTokenQuotes] = useState<TokenQuote[]>([]);
  const [lendingPairs, setLendingPairs] = useState<LendingPair[]>([]);
  const [lendingPairBalances, setLendingPairBalances] = useState<LendingPairBalances[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedOptions, setSelectedOptions] = useState<MultiDropdownOption[]>(filterOptions);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(10);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  return (
    <AppPage>
      <Container>
        <div className='flex flex-col gap-6 max-w-screen-2xl m-auto'>
          <div className='flex flex-col items-center'>
            <Text size='L' weight='bold' color='rgba(130, 160, 182, 1)'>
              YOUR PORTFOLIO
            </Text>
            <Display size='L' weight='semibold'>
              $1000.01
            </Display>
          </div>
          <AssetBar items={FAKE_DATA} />
          <div className='flex justify-between gap-4'>
            <OutlinedWhiteButtonWithIcon size='M' Icon={<DollarIcon />} svgColorType='stroke' position='leading'>
              Buy Crypto
            </OutlinedWhiteButtonWithIcon>
            <OutlinedWhiteButtonWithIcon size='M' Icon={<SendIcon />} svgColorType='stroke' position='leading'>
              Send Crypto
            </OutlinedWhiteButtonWithIcon>
            <OutlinedWhiteButtonWithIcon size='M' Icon={<TrendingUpIcon />} svgColorType='stroke' position='leading'>
              Earn Interest
            </OutlinedWhiteButtonWithIcon>
            <OutlinedWhiteButtonWithIcon size='M' Icon={<ShareIcon />} svgColorType='stroke' position='leading'>
              Withdraw
            </OutlinedWhiteButtonWithIcon>
          </div>
          <PortfolioGrid />
          <LendingPairPeerCard />
        </div>
      </Container>
      <WelcomeModal
        open={showWelcomeModal}
        setOpen={setShowWelcomeModal}
        onConfirm={() => {
          localStorage.setItem(WELCOME_MODAL_LOCAL_STORAGE_KEY, WELCOME_MODAL_LOCAL_STORAGE_VALUE);
        }}
      />
    </AppPage>
  );
}
