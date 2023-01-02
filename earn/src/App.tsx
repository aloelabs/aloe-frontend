import React, { Suspense, useEffect } from 'react';

import { ApolloClient, InMemoryCache, HttpLink, gql } from '@apollo/react-hooks';
import { Route, Routes, Navigate } from 'react-router-dom';
import Footer from 'shared/lib/components/common/Footer';
import WelcomeModal from 'shared/lib/components/common/WelcomeModal';
import { getLocalStorageBoolean, setLocalStorageBoolean } from 'shared/lib/util/LocalStorage';
import { Chain, useAccount, useNetwork } from 'wagmi';

import AppBody from './components/common/AppBody';
import Header from './components/header/Header';
import WagmiProvider from './connector/WagmiProvider';
import { DEFAULT_CHAIN } from './data/constants/Values';
import LendPage from './pages/LendPage';
import PortfolioPage from './pages/PortfolioPage';
import ScrollToTop from './util/ScrollToTop';

const CONNECT_WALLET_CHECKBOXES = [
  'I acknowledge that Aloe II is in beta and that use of the platform may result in loss of funds.',
];

export const theGraphUniswapV2Client = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2' }),
  cache: new InMemoryCache(),
});

export const theGraphUniswapV3Client = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3' }),
  cache: new InMemoryCache(),
});

export const theGraphEthereumBlocksClient = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks' }),
  cache: new InMemoryCache(),
});

export const ChainContext = React.createContext({
  activeChain: DEFAULT_CHAIN,
  setActiveChain: (chain: Chain) => {},
});

function AppBodyWrapper() {
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = React.useState(false);
  const { activeChain, setActiveChain } = React.useContext(ChainContext);
  const account = useAccount();
  const network = useNetwork();

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

  return (
    <AppBody>
      <Header checkboxes={CONNECT_WALLET_CHECKBOXES} />
      <main className='flex-grow'>
        <Routes>
          <Route path='/portfolio' element={<PortfolioPage />} />
          <Route path='/markets' element={<LendPage />} />
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
      />
    </AppBody>
  );
}

function App() {
  const [activeChain, setActiveChain] = React.useState<Chain>(DEFAULT_CHAIN);
  const [blockNumber, setBlockNumber] = React.useState<string | null>(null);
  const value = { activeChain, setActiveChain };
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
          <ChainContext.Provider value={value}>
            <ScrollToTop />
            <AppBodyWrapper />
          </ChainContext.Provider>
        </WagmiProvider>
      </Suspense>
    </>
  );
}

export default App;
