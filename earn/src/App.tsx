import React, { Suspense, useEffect } from 'react';

import { ApolloClient, InMemoryCache, HttpLink, gql } from '@apollo/react-hooks';
import { Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import AccountBlockedModal from 'shared/lib/components/common/AccountBlockedModal';
import Footer from 'shared/lib/components/common/Footer';
import { Text } from 'shared/lib/components/common/Typography';
import WelcomeModal from 'shared/lib/components/common/WelcomeModal';
import WagmiProvider from 'shared/lib/components/WagmiProvider';
import { AccountRiskResult } from 'shared/lib/data/AccountRisk';
import { screenAddress } from 'shared/lib/data/AccountRisk';
import { DEFAULT_CHAIN, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { fetchGeoFencing, GeoFencingResponse } from 'shared/lib/data/GeoFencing';
import { AccountRiskContext, useAccountRisk } from 'shared/lib/data/hooks/UseAccountRisk';
import useEffectOnce from 'shared/lib/data/hooks/UseEffectOnce';
import { GeoFencingContext, useGeoFencing } from 'shared/lib/data/hooks/UseGeoFencing';
import useSafeState from 'shared/lib/data/hooks/UseSafeState';
import { getLocalStorageBoolean, setLocalStorageBoolean } from 'shared/lib/util/LocalStorage';
import ScrollToTop from 'shared/lib/util/ScrollToTop';
import { useAccount, useNetwork } from 'wagmi';
import { Chain } from 'wagmi/chains';

import AppBody from './components/common/AppBody';
import Header from './components/header/Header';
import ImportBoostPage from './pages/boost/ImportBoostPage';
import ManageBoostPage from './pages/boost/ManageBoostPage';
import BoostPage from './pages/BoostPage';
import BorrowPage from './pages/BorrowPage';
import ClaimPage from './pages/ClaimPage';
import InfoPage from './pages/InfoPage';
import LeaderboardPage from './pages/LeaderboardPage';
import LendPage from './pages/LendPage';
import MarketsPage from './pages/MarketsPage';
import PortfolioPage from './pages/PortfolioPage';

const CONNECT_WALLET_CHECKBOXES = [
  <Text size='M' weight='regular'>
    I have read, understood, and agreed to the{' '}
    <a
      className='underline text-green-600 hover:text-green-700'
      href={TERMS_OF_SERVICE_URL}
      target='_blank'
      rel='noreferrer'
    >
      Terms of Service
    </a>{' '}
    and{' '}
    <a
      className='underline text-green-600 hover:text-green-700'
      href={PRIVACY_POLICY_URL}
      target='_blank'
      rel='noreferrer'
    >
      Privacy Policy
    </a>
    .
  </Text>,
  <Text>
    I will not use the platform in any way that violates applicable federal, state, local, or international laws.
  </Text>,
  <Text>I acknowledge that Aloe II is experimental software and use of the platform may result in loss of funds.</Text>,
];

export const theGraphUniswapV3Client = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3' }),
  cache: new InMemoryCache(),
});

export const theGraphUniswapV3ArbitrumClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-arbitrum-one' }),
  cache: new InMemoryCache(),
});

export const theGraphUniswapV3OptimismClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-post-regenesis' }),
  cache: new InMemoryCache(),
});

export const theGraphUniswapV3BaseClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest' }),
  cache: new InMemoryCache(),
});

export const theGraphUniswapV3GoerliClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/0xfind/uniswap-v3-goerli-2' }),
  cache: new InMemoryCache(),
});

export const theGraphEthereumBlocksClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks' }),
  cache: new InMemoryCache(),
});

export const ChainContext = React.createContext({
  activeChain: DEFAULT_CHAIN as Chain,
  setActiveChain: (chain: Chain) => {},
});

function AppBodyWrapper() {
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = React.useState(false);
  const { activeChain, setActiveChain } = React.useContext(ChainContext);
  const account = useAccount();
  const network = useNetwork();
  const navigate = useNavigate();
  const isAllowed = useGeoFencing(activeChain);
  const { isBlocked: isAccountBlocked, isLoading: isAccountRiskLoading } = useAccountRisk();

  useEffect(() => {
    if (network.chain !== undefined && network.chain !== activeChain) {
      setActiveChain(network.chain);
    }
  }, [activeChain, network.chain, setActiveChain]);

  useEffect(() => {
    const hasSeenWelcomeModal = getLocalStorageBoolean('hasSeenWelcomeModal');
    if (!account?.isConnecting && !account?.isConnected && !hasSeenWelcomeModal) {
      setIsWelcomeModalOpen(true);
    }
  }, [account?.isConnecting, account?.isConnected]);

  if (isAccountRiskLoading) {
    return null;
  }

  if (isAccountBlocked) {
    return <AccountBlockedModal isOpen={true} setIsOpen={() => {}} />;
  }

  return (
    <AppBody>
      <Header checkboxes={CONNECT_WALLET_CHECKBOXES} />
      <main className='flex-grow'>
        <Routes>
          <Route path='/portfolio' element={<PortfolioPage />} />
          <Route path='/markets' element={<MarketsPage />} />
          <Route path='/lend' element={<LendPage />} />
          <Route path='/stats' element={<InfoPage />} />
          <Route path='/leaderboard' element={<LeaderboardPage />} />
          {isAllowed && (
            <>
              <Route path='/boost' element={<BoostPage />} />
              <Route path='/boost/import/:tokenId' element={<ImportBoostPage />} />
              <Route path='/boost/manage/:nftTokenId' element={<ManageBoostPage />} />
              <Route path='/borrow' element={<BorrowPage />} />
            </>
          )}
          <Route path='/claim' element={<ClaimPage />} />
          <Route path='/' element={<Navigate replace to='/portfolio' />} />
          <Route path='*' element={<Navigate to='/' />} />
        </Routes>
      </main>
      <Footer />
      <WelcomeModal
        isOpen={isWelcomeModalOpen}
        activeChain={activeChain}
        checkboxes={CONNECT_WALLET_CHECKBOXES}
        account={account}
        setIsOpen={() => setIsWelcomeModalOpen(false)}
        onAcknowledged={() => setLocalStorageBoolean('hasSeenWelcomeModal', true)}
        onSkip={() => navigate('/markets')}
      />
      <AccountBlockedModal isOpen={isAccountBlocked} setIsOpen={() => {}} />
    </AppBody>
  );
}

function App() {
  const [activeChain, setActiveChain] = React.useState<Chain>(DEFAULT_CHAIN);
  const [blockNumber, setBlockNumber] = useSafeState<string | null>(null);
  const [accountRisk, setAccountRisk] = useSafeState<AccountRiskResult>({ isBlocked: false, isLoading: true });
  const [geoFencingResponse, setGeoFencingResponse] = React.useState<GeoFencingResponse | null>(null);
  const value = { activeChain, setActiveChain };
  const { address: userAddress } = useAccount();
  const twentyFourHoursAgo = Date.now() / 1000 - 24 * 60 * 60;
  const BLOCK_QUERY = gql`
  {
    blocks(first: 1, orderBy: timestamp, orderDirection: asc, where: {timestamp_gt: "${twentyFourHoursAgo.toFixed(
      0
    )}"}) {
      id
      number
      timestamp
    }
  }
  `;

  useEffectOnce(() => {
    let mounted = true;
    (async () => {
      const result = await fetchGeoFencing();
      if (mounted) {
        setGeoFencingResponse(result);
      }
    })();
    return () => {
      mounted = false;
    };
  });

  useEffect(() => {
    (async () => {
      if (userAddress === undefined) {
        setAccountRisk({ isBlocked: false, isLoading: false });
        return;
      }
      setAccountRisk({ isBlocked: false, isLoading: true });
      const result = await screenAddress(userAddress);
      setAccountRisk({ isBlocked: result.isBlocked, isLoading: false });
    })();
  }, [userAddress, setAccountRisk]);

  useEffect(() => {
    const queryBlocks = async () => {
      const response = await theGraphEthereumBlocksClient.query({ query: BLOCK_QUERY });
      setBlockNumber(response.data.blocks[0].number);
    };
    if (blockNumber === null) {
      queryBlocks();
    }
  });

  return (
    <>
      <Suspense fallback={null}>
        <WagmiProvider>
          <AccountRiskContext.Provider value={accountRisk}>
            <GeoFencingContext.Provider value={geoFencingResponse}>
              <ChainContext.Provider value={value}>
                <ScrollToTop />
                <AppBodyWrapper />
              </ChainContext.Provider>
            </GeoFencingContext.Provider>
          </AccountRiskContext.Provider>
        </WagmiProvider>
      </Suspense>
    </>
  );
}

export default App;
