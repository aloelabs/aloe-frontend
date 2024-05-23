import { useMemo } from 'react';
import { LendingPair } from '../data/LendingPair';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import {
  API_PRICE_RELAY_LATEST_URL,
  API_PRICE_RELAY_HISTORICAL_URL,
  API_PRICE_RELAY_CONSOLIDATED_URL,
} from '../data/constants/Values';

type TokenSymbol = string;
type Quote = number;

export type PriceRelayLatestResponse = {
  [key: TokenSymbol]: {
    price: Quote;
  };
};

export type PriceRelayHistoricalResponse = {
  [key: TokenSymbol]: {
    prices: {
      price: Quote;
      timestamp: number;
    }[];
  };
};

export type PriceRelayConsolidatedResponse = {
  latest: PriceRelayLatestResponse;
  historical: PriceRelayHistoricalResponse;
};

/// Compute unique tokens, sorted alphabetically
function commaSeparatedSymbolsFor(lendingPairs: LendingPair[]) {
  const symbolSet = new Set<string>();
  lendingPairs.forEach((pair) => {
    symbolSet.add(pair.token0.symbol);
    symbolSet.add(pair.token1.symbol);
  });
  if (symbolSet.has('USDC.e')) {
    symbolSet.delete('USDC.e');
    symbolSet.add('USDC');
  }

  const symbols = Array.from(symbolSet);
  symbols.sort((a, b) => a.localeCompare(b));
  return symbols.join(',').toUpperCase();
}

function toLatestPrices(response: PriceRelayLatestResponse) {
  const latestPrices = new Map<TokenSymbol, Quote>();
  Object.entries(response).forEach(([k, v]) => {
    latestPrices.set(k, v.price);
    latestPrices.set(k.toLowerCase(), v.price);
    if (k.toLowerCase() === 'usdc') {
      latestPrices.set('usdc.e', v.price);
      latestPrices.set('USDC.e', v.price);
    }
  });
  return latestPrices;
}

function toHistoricalPrices(response: PriceRelayHistoricalResponse) {
  const historicalPrices = new Map<TokenSymbol, { price: Quote; timestamp: number }[]>();
  Object.entries(response).forEach(([k, v]) => {
    historicalPrices.set(k, v.prices);
    historicalPrices.set(k.toLowerCase(), v.prices);
    if (k.toLowerCase() === 'usdc') {
      historicalPrices.set('usdc.e', v.prices);
      historicalPrices.set('USDC.e', v.prices);
    }
  });
  return historicalPrices;
}

export function useLatestPriceRelay(lendingPairs: LendingPair[], staleTime = 60 * 1_000) {
  const commaSeparatedSymbols = useMemo(() => commaSeparatedSymbolsFor(lendingPairs), [lendingPairs]);

  const queryFn = async () => {
    const response = (await axios.get(`${API_PRICE_RELAY_LATEST_URL}?symbols=${commaSeparatedSymbols}`)).data;
    if (!response) {
      throw new Error('Price relay failed to respond.');
    }
    return toLatestPrices(response);
  };

  const queryKey = ['usePriceRelay', 'latest', commaSeparatedSymbols];

  return useQuery({
    queryKey,
    queryFn,
    staleTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: staleTime,
    refetchIntervalInBackground: false,
    placeholderData: new Map<TokenSymbol, Quote>(),
    enabled: lendingPairs.length > 0,
  });
}

export function useHistoricalPriceRelay(lendingPairs: LendingPair[], staleTime = 20 * 60 * 1_000) {
  const commaSeparatedSymbols = useMemo(() => commaSeparatedSymbolsFor(lendingPairs), [lendingPairs]);

  const queryFn = async () => {
    const response = (await axios.get(`${API_PRICE_RELAY_HISTORICAL_URL}?symbols=${commaSeparatedSymbols}`)).data;
    if (!response) {
      throw new Error('Price relay failed to respond.');
    }
    return toHistoricalPrices(response);
  };

  const queryKey = ['usePriceRelay', 'historical', commaSeparatedSymbols];

  return useQuery({
    queryKey,
    queryFn,
    staleTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: staleTime,
    refetchIntervalInBackground: false,
    placeholderData: new Map<TokenSymbol, { price: Quote; timestamp: number }[]>(),
    enabled: lendingPairs.length > 0,
  });
}

export function useConsolidatedPriceRelay(lendingPairs: LendingPair[], staleTime = 60 * 1_000) {
  const commaSeparatedSymbols = useMemo(() => commaSeparatedSymbolsFor(lendingPairs), [lendingPairs]);

  const queryFn = async () => {
    const response = (await axios.get(`${API_PRICE_RELAY_CONSOLIDATED_URL}?symbols=${commaSeparatedSymbols}`)).data;
    if (!response) {
      throw new Error('Price relay failed to respond.');
    }
    return {
      latestPrices: toLatestPrices(response.latest),
      historicalPrices: toHistoricalPrices(response.historical),
    };
  };

  const queryKey = ['usePriceRelay', 'consolidated', commaSeparatedSymbols];

  return useQuery({
    queryKey,
    queryFn,
    staleTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: staleTime,
    refetchIntervalInBackground: false,
    placeholderData: {
      latestPrices: new Map<TokenSymbol, Quote>(),
      historicalPrices: new Map<TokenSymbol, { price: Quote; timestamp: number }[]>(),
    },
    enabled: lendingPairs.length > 0,
  });
}
