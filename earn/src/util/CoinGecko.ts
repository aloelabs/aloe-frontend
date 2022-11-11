import axios, { AxiosResponse } from 'axios';
import rateLimit from 'axios-rate-limit';
import { Address } from 'wagmi';

const http = rateLimit(axios.create(), {
  maxRequests: 50,
  perMilliseconds: 60000,
});

export function getMarketData(address: Address): Promise<AxiosResponse> {
  return http.get(
    `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}/market_chart?vs_currency=usd&days=1`
  );
}
