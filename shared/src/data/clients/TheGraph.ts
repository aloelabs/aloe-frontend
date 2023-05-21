import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/react-hooks';

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
