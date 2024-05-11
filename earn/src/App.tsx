import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/react-hooks';
import * as Sentry from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes, Navigate } from 'react-router-dom';
import AccountBlockedModal from 'shared/lib/components/common/AccountBlockedModal';
import Footer from 'shared/lib/components/common/Footer';
import { Text } from 'shared/lib/components/common/Typography';
import { wagmiConfig } from 'shared/lib/components/WagmiConfig';
import { AccountRiskResult } from 'shared/lib/data/AccountRisk';
import { screenAddress } from 'shared/lib/data/AccountRisk';
import { DEFAULT_CHAIN, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { fetchGeoFencing, GeoFencingInfo } from 'shared/lib/data/GeoFencing';
import { AccountRiskContext } from 'shared/lib/data/hooks/UseAccountRisk';
import useEffectOnce from 'shared/lib/data/hooks/UseEffectOnce';
import { GeoFencingContext } from 'shared/lib/data/hooks/UseGeoFencing';
import useSafeState from 'shared/lib/data/hooks/UseSafeState';
import ScrollToTop from 'shared/lib/util/ScrollToTop';
import { isDevelopment } from 'shared/lib/util/Utils';
import { Chain } from 'viem';
import { Config, useAccount, useClient, WagmiProvider } from 'wagmi';

import AppBody from './components/common/AppBody';
import Header from './components/header/Header';
import { LendingPairsContext } from './data/hooks/UseLendingPairs';
import { getAvailableLendingPairs, LendingPair } from './data/LendingPair';
import AdvancedPage from './pages/AdvancedPage';
import ImportBoostPage from './pages/boost/ImportBoostPage';
import ManageBoostPage from './pages/boost/ManageBoostPage';
import BoostPage from './pages/BoostPage';
import LeaderboardPage from './pages/LeaderboardPage';
import MarketsPage from './pages/MarketsPage';
import PortfolioPage from './pages/PortfolioPage';
import { useEthersProvider } from './util/Provider';

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

// TODO: Need TheGraph for Linea and Scroll

export const ChainContext = React.createContext({
  activeChain: DEFAULT_CHAIN as Chain,
  setActiveChain: (chain: Chain) => {},
});

function AppBodyWrapper() {
  const [activeChain, setActiveChain] = useState<Chain>(DEFAULT_CHAIN);

  const mounted = useRef(true);

  const [accountRisk, setAccountRisk] = useSafeState<AccountRiskResult>({ isBlocked: false, isLoading: true });
  const [geoFencingInfo, setGeoFencingInfo] = useSafeState<GeoFencingInfo>({
    isAllowed: false,
    isLoading: true,
  });
  const [lendingPairs, setLendingPairs] = useState<LendingPair[] | null>(null);

  const { address: userAddress } = useAccount();
  const client = useClient<Config>({ chainId: activeChain.id });
  const provider = useEthersProvider(client);

  const refetch = useCallback(async () => {
    if (!provider) return;
    const res = await getAvailableLendingPairs(activeChain.id, provider);
    if (mounted.current) setLendingPairs(res);
  }, [activeChain.id, provider, setLendingPairs]);

  const lendingPairsContextValue = useMemo(() => ({ lendingPairs, refetch }), [lendingPairs, refetch]);
  const chainContextValue = { activeChain, setActiveChain };

  useEffect(() => {
    Sentry.setTag('chain_name', activeChain.name);
  }, [activeChain]);

  useEffectOnce(() => {
    (async () => {
      const result = await fetchGeoFencing();
      setGeoFencingInfo({
        isAllowed: result.isAllowed,
        isLoading: false,
      });
    })();
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
    mounted.current = true;
    refetch();
    return () => {
      mounted.current = false;
    };
  }, [refetch]);

  const isAccountRiskLoading = accountRisk.isLoading;
  const isAccountBlocked = accountRisk.isBlocked;
  const isAllowed = isDevelopment() || geoFencingInfo.isAllowed || Boolean(activeChain.testnet);
  if (isAccountRiskLoading) {
    return null;
  }

  if (isAccountBlocked) {
    return <AccountBlockedModal isOpen={true} setIsOpen={() => {}} />;
  }

  return (
    <AccountRiskContext.Provider value={accountRisk}>
      <GeoFencingContext.Provider value={geoFencingInfo}>
        <ChainContext.Provider value={chainContextValue}>
          <LendingPairsContext.Provider value={lendingPairsContextValue}>
            <ScrollToTop />
            <AppBody>
              <Header checkboxes={CONNECT_WALLET_CHECKBOXES} />
              <main className='flex-grow'>
                <Routes>
                  <Route path='/portfolio' element={<PortfolioPage />} />
                  <Route path='/markets' element={<MarketsPage />} />
                  <Route path='/leaderboard' element={<LeaderboardPage />} />
                  {isAllowed && (
                    <>
                      <Route path='/boost' element={<BoostPage />} />
                      <Route path='/boost/import/:tokenId' element={<ImportBoostPage />} />
                      <Route path='/boost/manage/:nftTokenId' element={<ManageBoostPage />} />
                    </>
                  )}
                  <Route path='/borrow' element={<AdvancedPage />} />
                  <Route path='/' element={<Navigate replace to='/markets' />} />
                  <Route path='*' element={<Navigate to='/' />} />
                </Routes>
              </main>
              <Footer />
              <AccountBlockedModal isOpen={isAccountBlocked} setIsOpen={() => {}} />
            </AppBody>
          </LendingPairsContext.Provider>
        </ChainContext.Provider>
      </GeoFencingContext.Provider>
    </AccountRiskContext.Provider>
  );
}

const queryClient = new QueryClient();

function App() {
  return (
    <Suspense fallback={null}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <AppBodyWrapper />
        </QueryClientProvider>
      </WagmiProvider>
    </Suspense>
  );
}

export default App;
