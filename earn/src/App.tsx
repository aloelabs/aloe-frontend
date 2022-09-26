import React, { Suspense, useEffect } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';

import WagmiProvider from './connector/WagmiProvider';
import Header from './components/header/Header';
import Footer from './components/common/Footer';

import AppBody from './components/common/AppBody';
import { RedirectPartialPath } from './util/RedirectPartialPath';
import ScrollToTop from './util/ScrollToTop';
import { IS_DEV } from './util/Env';
import { ApolloClient, InMemoryCache, HttpLink, gql } from '@apollo/react-hooks';
import LendPage from './pages/LendPage';

export const theGraphUniswapV2Client = new ApolloClient({
  link: new HttpLink({
    uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
  }),
  cache: new InMemoryCache(),
});

export const theGraphUniswapV3Client = new ApolloClient({
  link: new HttpLink({
    uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  }),
  cache: new InMemoryCache(),
});

export const theGraphEthereumBlocksClient = new ApolloClient({
  link: new HttpLink({
    uri: 'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
  }),
  cache: new InMemoryCache(),
});

function App() {
  const [blockNumber, setBlockNumber] = React.useState<string | null>(null);
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
      const response = await theGraphEthereumBlocksClient.query({
        query: BLOCK_QUERY,
      });
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
          <ScrollToTop />
          <AppBody>
            <Header />
            <main className='flex-grow'>
              <Routes>
                <Route path='/lend' element={<LendPage />} />
                <Route path='/' element={<Navigate replace to='/lend' />} />
                <Route path='*' element={<Navigate to='/' />} />
              </Routes>
            </main>
            <Footer />
          </AppBody>
        </WagmiProvider>
      </Suspense>
    </>
  );
}

export default App;
