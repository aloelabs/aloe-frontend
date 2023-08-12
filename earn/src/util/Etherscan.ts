import axios from 'axios';
import { base } from 'shared/lib/data/BaseChain';
import { arbitrum, optimism, mainnet, goerli } from 'wagmi/chains';

const ETHERSCAN_DOMAINS_BY_CHAIN_ID: { [chainId: number]: string } = {
  [mainnet.id]: 'api.etherscan.io',
  [goerli.id]: 'api-goerli.etherscan.io',
  [optimism.id]: 'api-optimistic.etherscan.io',
  [arbitrum.id]: 'api.arbiscan.io',
  [base.id]: 'api.basescan.org',
};

const ETHERSCAN_API_KEYS: { [chainId: number]: string | undefined } = {
  [mainnet.id]: process.env.REACT_APP_ETHERSCAN_API_KEY,
  [goerli.id]: process.env.REACT_APP_ETHERSCAN_API_KEY,
  [optimism.id]: process.env.REACT_APP_OPTIMISTIC_ETHERSCAN_API_KEY,
  [arbitrum.id]: process.env.REACT_APP_ARBISCAN_API_KEY,
  [base.id]: process.env.REACT_APP_BASESCAN_API_KEY,
};

export function makeEtherscanRequest(
  fromBlock: number,
  address: string,
  topics: (string | null)[],
  shouldMatchAll: boolean,
  chainId: number,
  pageLength = 1000,
  page?: number,
  toBlock?: number
) {
  const domain = ETHERSCAN_DOMAINS_BY_CHAIN_ID[chainId];
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
  query += `&offset=${pageLength}`;
  if (ETHERSCAN_API_KEYS[chainId]) query += `&apikey=${ETHERSCAN_API_KEYS[chainId]}`;

  return axios.get(query);
}
