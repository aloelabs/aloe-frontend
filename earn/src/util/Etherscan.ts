import axios from 'axios';
import { chain as wagmiChain } from 'wagmi';

const ETHERSCAN_DOMAINS_BY_CHAIN_ID = {
  [wagmiChain.mainnet.id]: 'api.etherscan.io',
  [wagmiChain.goerli.id]: 'api-goerli.etherscan.io',
  [wagmiChain.optimism.id]: 'api-optimistic.etherscan.io',
  [wagmiChain.arbitrum.id]: 'api.arbiscan.io',
};

const ETHERSCAN_API_KEYS = {
  [wagmiChain.mainnet.id]: process.env.REACT_APP_ETHERSCAN_API_KEY,
  [wagmiChain.goerli.id]: process.env.REACT_APP_ETHERSCAN_API_KEY,
  [wagmiChain.optimism.id]: process.env.REACT_APP_OPTIMISTIC_ETHERSCAN_API_KEY,
  [wagmiChain.arbitrum.id]: process.env.REACT_APP_ARBISCAN_API_KEY,
};

export function makeEtherscanRequest(
  fromBlock: number,
  address: string,
  topics: (string | null)[],
  shouldMatchAll: boolean,
  chain = wagmiChain.mainnet,
  pageLength = 1000,
  page?: number,
  toBlock?: number
) {
  const domain = ETHERSCAN_DOMAINS_BY_CHAIN_ID[chain.id];
  let query = `https://${domain}/api?module=logs&action=getLogs`.concat(
    `&fromBlock=${fromBlock.toFixed(0)}`,
    toBlock ? `&toBlock=${toBlock.toFixed(0)}` : '&toBlock=latest',
    `&address=${address}`
  );

  for (let i = 0; i < topics.length; i += 1) {
    if (topics[i] === null) continue;
    query += `&topic${i}=${topics[i]}`;

    if (i === topics.length - 1) break;
    query += `&topic${i}_${i + 1}_opr=${shouldMatchAll ? 'and' : 'or'}`;
  }

  if (page) query += `&page=${page}`;
  query = query.concat(`&offset=${pageLength}`, `&apikey=${ETHERSCAN_API_KEYS[chain.id]}`);

  return axios.get(query);
}
