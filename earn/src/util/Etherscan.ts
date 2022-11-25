import axios from 'axios';

export function makeEtherscanRequest(
  fromBlock: number,
  address: string,
  topics: (string | null)[],
  shouldMatchAll: boolean,
  subdomain = 'api',
  pageLength = 1000,
  page?: number,
  toBlock?: number
) {
  let query = `https://${subdomain}.etherscan.io/api?module=logs&action=getLogs`.concat(
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
  query = query.concat(`&offset=${pageLength}`, `&apikey=${process.env.REACT_APP_ETHERSCAN_API_KEY}`);

  return axios.get(query);
}

export function getTransactionsByAddress(
  fromBlock: number,
  address: string,
  subdomain = 'api',
  pageLength = 50,
  page?: number,
  toBlock?: number
) {
  let query = `https://${subdomain}.etherscan.io/api?module=account&action=txlist`.concat(
    `&address=${address}`,
    `&startblock=${fromBlock.toFixed(0)}`,
    toBlock ? `&endblock=${toBlock.toFixed(0)}` : '&endblock=99999999',
    `&page=${page || 1}`,
    `&offset=${pageLength}`,
    `&sort=desc`,
    `&apikey=${process.env.REACT_APP_ETHERSCAN_API_KEY}`
  );

  return axios.get(query);
}

export function getErc20TransactionsByAddress(
  fromBlock: number,
  address: string,
  subdomain = 'api',
  pageLength = 50,
  page?: number,
  toBlock?: number
) {
  let query = `https://${subdomain}.etherscan.io/api?module=account&action=tokentx`.concat(
    `&address=${address}`,
    `&startblock=${fromBlock.toFixed(0)}`,
    toBlock ? `&endblock=${toBlock.toFixed(0)}` : '&endblock=99999999',
    `&page=${page || 1}`,
    `&offset=${pageLength}`,
    `&sort=desc`,
    `&apikey=${process.env.REACT_APP_ETHERSCAN_API_KEY}`
  );

  return axios.get(query);
}
