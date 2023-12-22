import React, { Suspense, useContext, useEffect, useState } from 'react';

import { ApolloClient, InMemoryCache, HttpLink, gql } from '@apollo/react-hooks';
import { Route, Routes, Navigate } from 'react-router-dom';
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
import { GeoFencingContext } from 'shared/lib/data/hooks/UseGeoFencing';
import useSafeState from 'shared/lib/data/hooks/UseSafeState';
import { getLocalStorageBoolean, setLocalStorageBoolean } from 'shared/lib/util/LocalStorage';
import ScrollToTop from 'shared/lib/util/ScrollToTop';
import { useAccount, useNetwork } from 'wagmi';
import { Chain } from 'wagmi/chains';

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

export const theGraphUniswapV2Client = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2' }),
  cache: new InMemoryCache(),
});

export const theGraphUniswapV3Client = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3' }),
  cache: new InMemoryCache(),
});

export const theGraphUniswapV3ArbitrumClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal' }),
  cache: new InMemoryCache(),
});

export const theGraphUniswapV3OptimismClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-post-regenesis' }),
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
  isChainLoading: true,
  setActiveChain: (chain: Chain) => {},
  setIsChainLoading: (isLoading: boolean) => {},
});

function AppBodyWrapper() {
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const { activeChain, isChainLoading, setActiveChain, setIsChainLoading } = useContext(ChainContext);
  const account = useAccount();
  const network = useNetwork();
  const { isBlocked: isAccountBlocked } = useAccountRisk();

  useEffect(() => {
    const hasSeenWelcomeModal = getLocalStorageBoolean('hasSeenWelcomeModal');
    if (!account?.isConnecting && !account?.isConnected && !hasSeenWelcomeModal) {
      setIsWelcomeModalOpen(true);
    }
  }, [account?.isConnecting, account?.isConnected]);

  useEffect(() => {
    if (network.chain !== undefined && network.chain !== activeChain) {
      setActiveChain(network.chain);
      setIsChainLoading(false);
    }
  }, [activeChain, network.chain, setActiveChain, setIsChainLoading]);

  useEffect(() => {
    if (account?.isDisconnected && !account?.isConnecting && isChainLoading) {
      setIsChainLoading(false);
    }
  }, [account?.isConnecting, account?.isDisconnected, isChainLoading, setIsChainLoading]);

  return (
    <AppBody>
      <Header checkboxes={CONNECT_WALLET_CHECKBOXES} />
      {!isChainLoading && (
        <main className='flex-grow'>
          <Routes>
            <Route path='/borrow' element={<BorrowAccountsPage />} />
            <Route path='/borrow/account/:account' element={<BorrowActionsPage />} />
            <Route path='/' element={<Navigate replace to='/borrow' />} />
            <Route path='*' element={<Navigate to='/' />} />
          </Routes>
        </main>
      )}
      <Footer />
      <WelcomeModal
        isOpen={isWelcomeModalOpen}
        activeChain={activeChain}
        checkboxes={CONNECT_WALLET_CHECKBOXES}
        account={account}
        setIsOpen={() => setIsWelcomeModalOpen(false)}
        onAcknowledged={() => setLocalStorageBoolean('hasSeenWelcomeModal', true)}
      />
      <AccountBlockedModal isOpen={isAccountBlocked} setIsOpen={() => {}} />
    </AppBody>
  );
}

function App() {
  const [activeChain, setActiveChain] = React.useState<Chain>(DEFAULT_CHAIN);
  const [isChainLoading, setIsChainLoading] = React.useState(true);
  const [blockNumber, setBlockNumber] = React.useState<string | null>(null);
  const [accountRisk, setAccountRisk] = useSafeState<AccountRiskResult>({ isBlocked: false, isLoading: true });
  const [geoFencingResponse, setGeoFencingResponse] = React.useState<GeoFencingResponse | null>(null);
  const { address: userAddress } = useAccount();

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

  const value = {
    activeChain,
    isChainLoading,
    setActiveChain,
    setIsChainLoading,
  };

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

  useEffect(() => {
    let mounted = true;

    const queryBlocks = async () => {
      const response = await theGraphEthereumBlocksClient.query({ query: BLOCK_QUERY });
      if (mounted) {
        setBlockNumber(response.data.blocks[0].number);
      }
    };
    if (blockNumber === null) {
      queryBlocks();
    }

    return () => {
      mounted = false;
    };
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
