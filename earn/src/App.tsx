import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import * as Sentry from '@sentry/react';
import { Route, Routes, Navigate } from 'react-router-dom';
import AccountBlockedModal from 'shared/lib/components/common/AccountBlockedModal';
import Footer from 'shared/lib/components/common/Footer';
import { Text } from 'shared/lib/components/common/Typography';
import { Web3Provider } from 'shared/lib/components/WagmiConfig';
import { AccountRiskResult } from 'shared/lib/data/AccountRisk';
import { screenAddress } from 'shared/lib/data/AccountRisk';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { fetchGeoFencing, GeoFencingInfo } from 'shared/lib/data/GeoFencing';
import { AccountRiskContext } from 'shared/lib/data/hooks/UseAccountRisk';
import useEffectOnce from 'shared/lib/data/hooks/UseEffectOnce';
import { GeoFencingContext } from 'shared/lib/data/hooks/UseGeoFencing';
import { LendingPairsContext } from 'shared/lib/data/hooks/UseLendingPairs';
import { getAvailableLendingPairs, LendingPair } from 'shared/lib/data/LendingPair';
import ScrollToTop from 'shared/lib/util/ScrollToTop';
import { isDevelopment } from 'shared/lib/util/Utils';
import { useAccount, usePublicClient } from 'wagmi';

import AppBody from './components/common/AppBody';
import Header from './components/header/Header';
import AdvancedPage from './pages/AdvancedPage';
import ImportBoostPage from './pages/boost/ImportBoostPage';
import ManageBoostPage from './pages/boost/ManageBoostPage';
import BoostPage from './pages/BoostPage';
import LeaderboardPage from './pages/LeaderboardPage';
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

// TODO: Need TheGraph for Linea and Scroll

function AppBodyWrapper() {
  const [accountRisk, setAccountRisk] = useState<AccountRiskResult>({ isBlocked: false, isLoading: true });
  const [geoFencingInfo, setGeoFencingInfo] = useState<GeoFencingInfo>({
    isAllowed: false,
    isLoading: true,
  });
  const [lendingPairs, setLendingPairs] = useState<{ lendingPairs: LendingPair[] | null; chainId: number }>({
    lendingPairs: null,
    chainId: -1,
  });

  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();

  const refetch = useCallback(async () => {
    if (publicClient === undefined) return;
    const chainId = publicClient.chain.id;
    const res = await getAvailableLendingPairs(chainId, publicClient);
    setLendingPairs({ lendingPairs: res, chainId });
  }, [publicClient]);

  const lendingPairsContextValue = useMemo(() => ({ ...lendingPairs, refetch }), [lendingPairs, refetch]);

  useEffect(() => {
    if (!publicClient) return;
    Sentry.setTag('chain_name', publicClient.chain.name);
  }, [publicClient]);

  useEffect(() => {
    refetch();
  }, [refetch]);

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

  const isAccountRiskLoading = accountRisk.isLoading;
  const isAccountBlocked = accountRisk.isBlocked;
  const isAllowed = isDevelopment() || geoFencingInfo.isAllowed || Boolean(publicClient?.chain.testnet);

  if (isAccountRiskLoading) {
    return null;
  }

  if (isAccountBlocked) {
    return <AccountBlockedModal isOpen={true} setIsOpen={() => {}} />;
  }

  return (
    <AccountRiskContext.Provider value={accountRisk}>
      <GeoFencingContext.Provider value={geoFencingInfo}>
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
      </GeoFencingContext.Provider>
    </AccountRiskContext.Provider>
  );
}

function App() {
  return (
    <Suspense fallback={null}>
      <Web3Provider>
        <AppBodyWrapper />
      </Web3Provider>
    </Suspense>
  );
}

export default App;
