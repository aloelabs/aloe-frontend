import React, { Suspense, useEffect } from 'react';

import { ApolloClient, InMemoryCache, HttpLink, gql } from '@apollo/react-hooks';
import axios, { AxiosResponse } from 'axios';
import { Route, Routes, Navigate } from 'react-router-dom';
import Footer from 'shared/lib/components/common/Footer';
import { DEFAULT_CHAIN } from 'shared/lib/data/constants/Values';
import { Chain, useNetwork } from 'wagmi';

import AppBody from './components/common/AppBody';
import Header from './components/header/Header';
import WagmiProvider from './connector/WagmiProvider';
import { API_GEO_FENCING_URL } from './data/constants/Values';
import { GeoFencingResponse } from './data/GeoFencingResponse';
import useEffectOnce from './data/hooks/UseEffectOnce';
import BorrowAccountsPage from './pages/BorrowAccountsPage';
import BorrowActionsPage from './pages/BorrowActionsPage';
import ScrollToTop from './util/ScrollToTop';

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

export const GeoFencingContext = React.createContext({ isAllowedToInteract: false });

function AppBodyWrapper() {
  const { activeChain, setActiveChain } = React.useContext(ChainContext);
  const network = useNetwork();

  useEffect(() => {
    if (network.chain !== undefined && network.chain !== activeChain) {
      setActiveChain(network.chain);
    }
  }, [activeChain, network.chain, setActiveChain]);

  return (
    <AppBody>
      <Header />
      <main className='flex-grow'>
        <Routes>
          <Route path='/borrow' element={<BorrowAccountsPage />} />
          <Route path='/borrow/account/:account' element={<BorrowActionsPage />} />
          <Route path='/' element={<Navigate replace to='/borrow' />} />
          <Route path='*' element={<Navigate to='/' />} />
        </Routes>
      </main>
      <Footer />
    </AppBody>
  );
}

function App() {
  const [activeChain, setActiveChain] = React.useState<Chain>(DEFAULT_CHAIN);
  const [blockNumber, setBlockNumber] = React.useState<string | null>(null);
  const [isAllowedToInteract, setIsAllowedToInteract] = React.useState<boolean>(false);

  useEffectOnce(() => {
    let mounted = true;
    async function fetch() {
      let geoFencingResponse: AxiosResponse<GeoFencingResponse> | null = null;
      try {
        geoFencingResponse = await axios.get(API_GEO_FENCING_URL);
      } catch (error) {
        console.error(error);
      }
      if (geoFencingResponse == null) {
        if (mounted) {
          setIsAllowedToInteract(false);
        }
        return;
      }
      if (mounted) {
        setIsAllowedToInteract(geoFencingResponse.data.isAllowed);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  });

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
          <GeoFencingContext.Provider value={{ isAllowedToInteract }}>
            <ChainContext.Provider value={value}>
              <ScrollToTop />
              <AppBodyWrapper />
            </ChainContext.Provider>
          </GeoFencingContext.Provider>
        </WagmiProvider>
      </Suspense>
    </>
  );
}

export default App;
