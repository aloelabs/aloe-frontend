import { useEffect, useMemo, useState } from 'react';

import axios, { AxiosResponse } from 'axios';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text, Display } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { chain, useAccount, useNetwork, useProvider } from 'wagmi';

import { ReactComponent as DollarIcon } from '../assets/svg/dollar.svg';
import { ReactComponent as SendIcon } from '../assets/svg/send.svg';
import { ReactComponent as ShareIcon } from '../assets/svg/share.svg';
import { ReactComponent as TrendingUpIcon } from '../assets/svg/trending_up.svg';
import { AssetBar } from '../components/portfolio/AssetBar';
import { AssetBarPlaceholder } from '../components/portfolio/AssetBarPlaceholder';
import LendingPairPeerCard from '../components/portfolio/LendingPairPeerCard';
import PortfolioActionButton from '../components/portfolio/PortfolioActionButton';
import PortfolioGrid from '../components/portfolio/PortfolioGrid';
import { API_PRICE_RELAY_CONSOLIDATED_URL } from '../data/constants/Values';
import {
  getAvailableLendingPairs,
  getLendingPairBalances,
  LendingPair,
  LendingPairBalances,
} from '../data/LendingPair';
import { PriceRelayConsolidatedResponse } from '../data/PriceRelayResponse';
import { getReferenceAddress, GetTokenDataByTicker, TokenData } from '../data/TokenData';
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

export type PriceEntry = {
  price: number;
  timestamp: number;
};

export type TokenQuote = {
  token: TokenData;
  price: number;
};

export type TokenPriceData = {
  token: TokenData;
  priceEntries: PriceEntry[];
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
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [errorLoadingPrices, setErrorLoadingPrices] = useState(false);
  const [activeAsset, setActiveAsset] = useState<TokenData | null>(null);

  const network = useNetwork();
  const activeChainId = network.chain?.id || chain.goerli.id;
  const provider = useProvider({ chainId: activeChainId });
  const { address, isConnecting, isConnected } = useAccount();

  const uniqueTokens = useMemo(() => {
    const tokens = new Set<TokenData>();
    lendingPairs.forEach((pair) => {
      tokens.add(pair.token0);
      tokens.add(pair.token1);
    });
    return Array.from(tokens);
  }, [lendingPairs]);

  /**
   * Get the latest and historical prices for all tokens
   */
  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const symbols = uniqueTokens
        .map((token) => token?.ticker)
        .filter((ticker) => ticker !== undefined)
        .join(',');
      if (symbols.length === 0) {
        return;
      }
      let priceRelayResponses: AxiosResponse<PriceRelayConsolidatedResponse> | null = null;
      try {
        priceRelayResponses = await axios.get(`${API_PRICE_RELAY_CONSOLIDATED_URL}?symbols=${symbols}`);
      } catch (error) {
        setErrorLoadingPrices(true);
        setIsLoadingPrices(false);
        return;
      }
      if (priceRelayResponses == null) {
        return;
      }
      const latestPriceResponse = priceRelayResponses.data.latest;
      const historicalPriceResponse = priceRelayResponses.data.historical;
      if (!latestPriceResponse || !historicalPriceResponse) {
        return;
      }
      const tokenQuoteData: TokenQuote[] = Object.entries(latestPriceResponse).map(([ticker, data]) => {
        return {
          token: GetTokenDataByTicker(ticker),
          price: data.price,
        };
      });
      const tokenPriceData: TokenPriceData[] = Object.entries(historicalPriceResponse).map(([ticker, data]) => {
        return {
          token: GetTokenDataByTicker(ticker),
          priceEntries: data.prices,
        };
      });
      if (mounted) {
        setTokenQuotes(tokenQuoteData);
        setTokenPriceData(tokenPriceData);
        setIsLoadingPrices(false);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [uniqueTokens]);

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
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [provider, address, lendingPairs, isLoading]);

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

  const filteredLendingPairs = useMemo(() => {
    if (activeAsset == null) {
      return [];
    }
    const activeAddress = getReferenceAddress(activeAsset);
    return lendingPairs.filter((pair) => {
      const token0Address = getReferenceAddress(pair.token0);
      const token1Address = getReferenceAddress(pair.token1);
      return token0Address === activeAddress || token1Address === activeAddress;
    });
  }, [lendingPairs, activeAsset]);

  const noWallet = !isConnecting && !isConnected;
  const isDoneLoading = !isLoadingPrices && (!isLoading || !noWallet);

  return (
    <AppPage>
      <Container>
        <div className='flex flex-col items-center mb-8'>
          <Text size='L' weight='bold' color='rgba(130, 160, 182, 1)'>
            YOUR PORTFOLIO
          </Text>
          <Display size='L' weight='semibold'>
            {errorLoadingPrices ? '$□□□' : formatUSD(totalBalanceUSD)}
          </Display>
        </div>
        <div className='h-16'>
          {!isDoneLoading && <AssetBarPlaceholder />}
          {isDoneLoading && (totalBalanceUSD > 0 || errorLoadingPrices) && (
            <AssetBar
              balances={combinedBalances}
              tokenColors={tokenColors}
              ignoreBalances={errorLoadingPrices}
              setActiveAsset={(updatedAsset: TokenData) => {
                setActiveAsset(updatedAsset);
              }}
            />
          )}
          {isDoneLoading && totalBalanceUSD === 0 && !errorLoadingPrices && (
            <EmptyAssetBar>
              <Text size='L' weight='medium' color='rgba(130, 160, 182, 1)'>
                No assets found
              </Text>
            </EmptyAssetBar>
          )}
        </div>
        <div className='flex justify-between gap-4 mt-5'>
          <PortfolioActionButton label={'Buy Crypto'} Icon={<DollarIcon />} onClick={() => {}} />
          <PortfolioActionButton label={'Send Crypto'} Icon={<SendIcon />} onClick={() => {}} />
          <PortfolioActionButton label={'Earn Interest'} Icon={<TrendingUpIcon />} onClick={() => {}} />
          <PortfolioActionButton label={'Withdraw'} Icon={<ShareIcon />} onClick={() => {}} />
        </div>
        <div className='mt-10'>
          <PortfolioGrid
            activeAsset={activeAsset}
            balances={combinedBalances}
            tokenColors={tokenColors}
            tokenPriceData={tokenPriceData}
            tokenQuotes={tokenQuotes}
            errorLoadingPrices={errorLoadingPrices}
          />
        </div>
        {isDoneLoading && filteredLendingPairs.length > 0 && activeAsset != null && (
          <div className='mt-8'>
            <LendingPairPeerCard activeAsset={activeAsset} lendingPairs={filteredLendingPairs} />
          </div>
        )}
      </Container>
    </AppPage>
  );
}
