import { Suspense, useEffect, useState } from 'react';

import * as Sentry from '@sentry/react';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Route, Routes, Navigate } from 'react-router-dom';
import AccountBlockedModal from 'shared/lib/components/common/AccountBlockedModal';
import Footer from 'shared/lib/components/common/Footer';
import { Text } from 'shared/lib/components/common/Typography';
import WelcomeModal from 'shared/lib/components/common/WelcomeModal';
import { wagmiConfig } from 'shared/lib/components/WagmiConfig';
import { AccountRiskResult } from 'shared/lib/data/AccountRisk';
import { screenAddress } from 'shared/lib/data/AccountRisk';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { fetchGeoFencing, GeoFencingInfo } from 'shared/lib/data/GeoFencing';
import { AccountRiskContext } from 'shared/lib/hooks/UseAccountRisk';
import useEffectOnce from 'shared/lib/hooks/UseEffectOnce';
import { GeoFencingContext } from 'shared/lib/hooks/UseGeoFencing';
import { getLocalStorageBoolean, setLocalStorageBoolean } from 'shared/lib/util/LocalStorage';
import ScrollToTop from 'shared/lib/util/ScrollToTop';
import { useAccount, usePublicClient, WagmiProvider, serialize, deserialize } from 'wagmi';

import AppBody from './components/common/AppBody';
import Header from './components/header/Header';
import BorrowAccountsPage from './pages/BorrowAccountsPage';
import BorrowActionsPage from './pages/BorrowActionsPage';

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
  <Text>I am not a citizen or resident of the United States.</Text>,
  <Text>I acknowledge that Aloe II is experimental software and use of the platform may result in loss of funds.</Text>,
];

function AppBodyWrapper() {
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [accountRisk, setAccountRisk] = useState<AccountRiskResult>({ isBlocked: false, isLoading: true });
  const [geoFencingInfo, setGeoFencingInfo] = useState<GeoFencingInfo>({
    isAllowed: false,
    isLoading: true,
  });

  const account = useAccount();
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!publicClient) return;
    Sentry.setTag('chain_name', publicClient.chain.name);
  }, [publicClient]);

  useEffect(() => {
    const hasSeenWelcomeModal = getLocalStorageBoolean('hasSeenWelcomeModal');
    if (!account.isConnecting && !account.isConnected && !hasSeenWelcomeModal) {
      setIsWelcomeModalOpen(true);
    }
  }, [account]);

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
      if (account.address === undefined) {
        setAccountRisk({ isBlocked: false, isLoading: false });
        return;
      }
      setAccountRisk({ isBlocked: false, isLoading: true });
      const result = await screenAddress(account.address);
      setAccountRisk({ isBlocked: result.isBlocked, isLoading: false });
    })();
  }, [account.address, setAccountRisk]);

  const isAccountRiskLoading = accountRisk.isLoading;
  const isAccountBlocked = accountRisk.isBlocked;
  // const isAllowed = isDevelopment() || geoFencingInfo.isAllowed || Boolean(client?.chain.testnet);

  if (isAccountRiskLoading) {
    return null;
  }

  if (isAccountBlocked) {
    return <AccountBlockedModal isOpen={true} setIsOpen={() => {}} />;
  }

  return (
    <AccountRiskContext.Provider value={accountRisk}>
      <GeoFencingContext.Provider value={geoFencingInfo}>
        <ScrollToTop />
        <AppBody>
          <Header checkboxes={CONNECT_WALLET_CHECKBOXES} />
          <main className='flex-grow'>
            <Routes>
              <Route path='/borrow' element={<BorrowAccountsPage />} />
              <Route path='/borrow/account/:account' element={<BorrowActionsPage />} />
              <Route path='/' element={<Navigate replace to='/borrow' />} />
              <Route path='*' element={<Navigate to='/' />} />
            </Routes>
          </main>
          <Footer />
          <WelcomeModal
            isOpen={isWelcomeModalOpen}
            checkboxes={CONNECT_WALLET_CHECKBOXES}
            setIsOpen={() => setIsWelcomeModalOpen(false)}
            onAcknowledged={() => setLocalStorageBoolean('hasSeenWelcomeModal', true)}
          />
          <AccountBlockedModal isOpen={isAccountBlocked} setIsOpen={() => {}} />
        </AppBody>
      </GeoFencingContext.Provider>
    </AccountRiskContext.Provider>
  );
}

const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 365 * 24 * 60 * 60 * 1_000 } } });

const persister = createSyncStoragePersister({
  serialize,
  storage: window.localStorage,
  deserialize,
});

function App() {
  return (
    <Suspense fallback={null}>
      <WagmiProvider config={wagmiConfig}>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
          <AppBodyWrapper />
        </PersistQueryClientProvider>
      </WagmiProvider>
    </Suspense>
  );
}

export default App;
