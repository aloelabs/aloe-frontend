import { useEffect, useMemo, useState } from 'react';

import axios, { AxiosResponse } from 'axios';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text, Display } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { chain, useAccount, useNetwork, useProvider } from 'wagmi';

import { AssetBar } from '../components/portfolio/AssetBar';
import { AssetBarPlaceholder } from '../components/portfolio/AssetBarPlaceholder';
import PortfolioGrid from '../components/portfolio/PortfolioGrid';
import { API_PRICE_RELAY_URL } from '../data/constants/Values';
import useEffectOnce from '../data/hooks/UseEffectOnce';
import {
  getAvailableLendingPairs,
  getLendingPairBalances,
  LendingPair,
  LendingPairBalances,
} from '../data/LendingPair';
import { PriceRelayResponse } from '../data/PriceRelayResponse';
import { getReferenceAddress, GetTokenData, TokenData } from '../data/TokenData';
import { getMarketData } from '../util/CoinGecko';
import { getProminentColor } from '../util/Colors';
import { formatUSD } from '../util/Numbers';

const Container = styled.div`
  max-width: 813px;
  margin: 0 auto;
`;

const EmptyAssetBar = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 64px;
  background-color: transparent;
  border: 1px solid rgba(26, 41, 52, 1);
  border-radius: 8px;
`;

export type TokenQuote = {
  token: TokenData;
  price: number;
};

export type TokenPriceData = {
  token: TokenData;
  prices: number[][]; // [timestamp, price]
};

export type TokenBalance = {
  token: TokenData;
  balance: number;
  balanceUSD: number;
  apy: number;
  isKitty: boolean;
  pairName: string;
};

export default function PortfolioPage() {
  const [tokenColors, setTokenColors] = useState<Map<string, string>>(new Map());
  const [tokenQuotes, setTokenQuotes] = useState<TokenQuote[]>([]);
  const [lendingPairs, setLendingPairs] = useState<LendingPair[]>([]);
  const [lendingPairBalances, setLendingPairBalances] = useState<LendingPairBalances[]>([]);
  const [tokenPriceData, setTokenPriceData] = useState<TokenPriceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBalances, setIsLoadingBalances] = useState(true);
  const [activeAsset, setActiveAsset] = useState<TokenData | null>(null);

  const network = useNetwork();
  const activeChainId = network.chain?.id || chain.goerli.id;
  const provider = useProvider({ chainId: activeChainId });
  const { address } = useAccount();

  const uniqueTokens = useMemo(() => {
    const tokens = new Set<TokenData>();
    lendingPairs.forEach((pair) => {
      tokens.add(pair.token0);
      tokens.add(pair.token1);
    });
    return Array.from(tokens);
  }, [lendingPairs]);

  /**
   * Get an initial esimate of the user's balances in USD
   */
  useEffectOnce(() => {
    let mounted = true;
    async function fetch() {
      // fetch token quotes
      const quoteDataResponse: AxiosResponse = await axios.get(API_PRICE_RELAY_URL);
      const prResponse: PriceRelayResponse = quoteDataResponse.data;
      if (!prResponse || !prResponse.data) {
        return;
      }
      const tokenQuoteData: TokenQuote[] = Object.values(prResponse.data).map((pr: any) => {
        return {
          token: GetTokenData(pr?.platform?.token_address || ''),
          price: pr?.quote['USD']?.price || 0,
        };
      });
      if (mounted && tokenQuotes.length === 0) {
        setTokenQuotes(tokenQuoteData);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  });

  useEffect(() => {
    let mounted = true;
    async function fetchTokenColors() {
      const tokenColorMap: Map<string, string> = new Map();
      const colorPromises = uniqueTokens.map((token) => getProminentColor(token.iconPath || ''));
      const colors = await Promise.all(colorPromises);
      uniqueTokens.forEach((token: TokenData, index: number) => {
        tokenColorMap.set(token.address, colors[index]);
      });
      if (mounted) {
        setTokenColors(tokenColorMap);
      }
    }
    fetchTokenColors();
    return () => {
      mounted = false;
    };
  }, [lendingPairs, uniqueTokens]);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (!provider) {
        return;
      }
      const results = await getAvailableLendingPairs(provider);
      if (mounted) {
        setLendingPairs(results);
        setIsLoading(false);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [provider]);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      // Checking for loading rather than number of pairs as pairs could be empty even if loading is false
      if (!address || isLoading) return;
      const results = await Promise.all(lendingPairs.map((p) => getLendingPairBalances(p, address, provider)));
      if (mounted) {
        setLendingPairBalances(results);
        setIsLoadingBalances(false);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [provider, address, lendingPairs, isLoading]);

  /**
   * Fetch token price data (for chart)
   * Also fetches updated token quotes (for consistency with chart)
   */
  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const tokens = lendingPairs.flatMap((p) => [p.token0, p.token1]);
      const requests = uniqueTokens.map((token) => getMarketData(getReferenceAddress(token)));
      const response = await Promise.all(requests);
      if (mounted) {
        const tokenGraphPrices: TokenPriceData[] = response.map((r, i) => {
          const data = r.data;
          return {
            token: tokens[i],
            prices: data?.prices || [],
          };
        });
        const tokenPrices: TokenQuote[] = tokenGraphPrices.map((t) => {
          const prices = t.prices;
          const lastPrice = prices[prices.length - 1];
          return {
            token: GetTokenData(t.token.referenceAddress || t.token.address),
            price: lastPrice ? lastPrice[1] : 0,
          };
        });
        setTokenPriceData(tokenGraphPrices);
        setTokenQuotes(tokenPrices);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [lendingPairs, uniqueTokens]);

  const combinedBalances: TokenBalance[] = useMemo(() => {
    const combined = lendingPairs.flatMap((pair, i) => {
      const token0Quote = tokenQuotes.find((quote) => quote.token.address === getReferenceAddress(pair.token0));
      const token1Quote = tokenQuotes.find((quote) => quote.token.address === getReferenceAddress(pair.token1));
      const token0Price = token0Quote?.price || 0;
      const token1Price = token1Quote?.price || 0;
      const pairName: string = `${pair.token0.ticker}-${pair.token1.ticker}`;
      return [
        {
          token: pair.token0,
          balance: lendingPairBalances?.[i]?.token0Balance || 0,
          balanceUSD: (lendingPairBalances?.[i]?.token0Balance || 0) * token0Price,
          apy: 0,
          isKitty: false,
          pairName,
          otherToken: pair.token1,
        },
        {
          token: pair.token1,
          balance: lendingPairBalances?.[i]?.token1Balance || 0,
          balanceUSD: (lendingPairBalances?.[i]?.token1Balance || 0) * token1Price,
          apy: 0,
          isKitty: false,
          pairName,
          otherToken: pair.token0,
        },
        {
          token: pair.kitty0,
          balance: lendingPairBalances?.[i]?.kitty0Balance || 0,
          balanceUSD: (lendingPairBalances?.[i]?.kitty0Balance || 0) * token0Price,
          apy: pair.kitty0Info.apy,
          isKitty: true,
          pairName,
          otherToken: pair.token1,
        },
        {
          token: pair.kitty1,
          balance: lendingPairBalances?.[i]?.kitty1Balance || 0,
          balanceUSD: (lendingPairBalances?.[i]?.kitty1Balance || 0) * token1Price,
          apy: pair.kitty1Info.apy,
          isKitty: true,
          pairName,
          otherToken: pair.token0,
        },
      ];
    });
    let distinct: TokenBalance[] = [];
    combined.forEach((balance) => {
      const existing = distinct.find((d) => d.token.address === balance.token.address);
      if (!existing) {
        distinct.push(balance);
      }
    });
    return distinct;
  }, [lendingPairs, lendingPairBalances, tokenQuotes]);

  const totalBalanceUSD = useMemo(() => {
    return combinedBalances.reduce((acc, balance) => acc + balance.balanceUSD, 0);
  }, [combinedBalances]);

  const isDoneLoadingBalances = (!isLoading && !address) || (!isLoadingBalances && combinedBalances.length > 0);

  return (
    <AppPage>
      <Container>
        <div className='flex flex-col items-center mb-8'>
          <Text size='L' weight='bold' color='rgba(130, 160, 182, 1)'>
            YOUR PORTFOLIO
          </Text>
          <Display size='L' weight='semibold'>
            {formatUSD(totalBalanceUSD)}
          </Display>
        </div>
        <div className='h-16'>
          {!isDoneLoadingBalances && <AssetBarPlaceholder />}
          {isDoneLoadingBalances && totalBalanceUSD > 0 && (
            <AssetBar
              balances={combinedBalances}
              tokenColors={tokenColors}
              setActiveAsset={(updatedAsset: TokenData) => {
                setActiveAsset(updatedAsset);
              }}
            />
          )}
          {isDoneLoadingBalances && totalBalanceUSD === 0 && (
            <EmptyAssetBar>
              <Text size='L' weight='medium' color='rgba(130, 160, 182, 1)'>
                No assets found
              </Text>
            </EmptyAssetBar>
          )}
        </div>
        <div className='mt-8'>
          <PortfolioGrid
            activeAsset={activeAsset}
            balances={combinedBalances}
            tokenColors={tokenColors}
            tokenPriceData={tokenPriceData}
            tokenQuotes={tokenQuotes}
          />
        </div>
      </Container>
    </AppPage>
  );
}
