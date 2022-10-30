import { useEffect, useMemo, useState } from 'react';

import axios, { AxiosResponse } from 'axios';
import rateLimit from 'axios-rate-limit';
import AppPage from 'shared/lib/components/common/AppPage';
import { OutlinedWhiteButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { MultiDropdownOption } from 'shared/lib/components/common/Dropdown';
import { Text, Display } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';
import { couldStartTrivia } from 'typescript';
import { chain, useAccount, useProvider } from 'wagmi';

import { ReactComponent as DollarIcon } from '../assets/svg/dollar.svg';
import { ReactComponent as SendIcon } from '../assets/svg/send.svg';
import { ReactComponent as ShareIcon } from '../assets/svg/share.svg';
import { ReactComponent as TrendingUpIcon } from '../assets/svg/trending_up.svg';
import WelcomeModal from '../components/lend/modal/WelcomeModal';
import AssetBar from '../components/portfolio/AssetBar';
import LendingPairPeerCard from '../components/portfolio/LendingPairPeerCard';
import PortfolioGrid from '../components/portfolio/PortfolioGrid';
import { RESPONSIVE_BREAKPOINT_XS } from '../data/constants/Breakpoints';
import { API_PRICE_RELAY_URL } from '../data/constants/Values';
import useEffectOnce from '../data/hooks/UseEffectOnce';
import {
  getAvailableLendingPairs,
  getLendingPairBalances,
  LendingPair,
  LendingPairBalances,
} from '../data/LendingPair';
import { PriceRelayResponse } from '../data/PriceRelayResponse';
import { GetTokenData, getTokens, TokenData } from '../data/TokenData';
import { getProminentColor } from '../util/Colors';
import { formatUSD } from '../util/Numbers';

const http = rateLimit(axios.create(), {
  maxRequests: 2,
  perMilliseconds: 500,
  maxRPS: 4,
});

const WELCOME_MODAL_LOCAL_STORAGE_KEY = 'acknowledged-welcome-modal-lend';
const WELCOME_MODAL_LOCAL_STORAGE_VALUE = 'acknowledged';

const LEND_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const Container = styled.div`
  max-width: 900px;
  margin: 0 auto;
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

type TokenColor = {
  token: TokenData;
  color: string;
};

export default function PortfolioPage() {
  // MARK: component state
  const [tokenQuotes, setTokenQuotes] = useState<TokenQuote[]>([]);
  const [lendingPairs, setLendingPairs] = useState<LendingPair[]>([]);
  const [lendingPairBalances, setLendingPairBalances] = useState<LendingPairBalances[]>([]);
  const [tokenColors, setTokenColors] = useState<Map<string, string>>(new Map());
  const [activeAsset, setActiveAsset] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [tokenPriceData, setTokenPriceData] = useState<TokenPriceData[]>([]);

  // MARK: wagmi hooks
  const provider = useProvider({ chainId: chain.goerli.id });
  const { address } = useAccount();

  useEffect(() => {
    async function fetchTokenColors() {
      const tokenColorMap: Map<string, string> = new Map();

      lendingPairs.forEach(async (pair) => {
        if (!tokenColorMap.has(pair.token0.address)) {
          tokenColorMap.set(pair.token0.address, await getProminentColor(pair.token0.iconPath || ''));
        }
        if (!tokenColorMap.has(pair.token1.address)) {
          tokenColorMap.set(pair.token1.address, await getProminentColor(pair.token1.iconPath || ''));
        }
      });
      setTokenColors(tokenColorMap);
    }
    fetchTokenColors();
  }, [lendingPairs]);

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
      if (mounted) {
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

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const tokens = lendingPairs.flatMap((p) => [p.token0, p.token1]);
      const requests = lendingPairs.flatMap((pair) => [
        http.get(
          `https://api.coingecko.com/api/v3/coins/ethereum/contract/${
            pair.token0.referenceAddress || pair.token0.address
          }/market_chart?vs_currency=usd&days=7`
        ),
        http.get(
          `https://api.coingecko.com/api/v3/coins/ethereum/contract/${
            pair.token1.referenceAddress || pair.token1.address
          }/market_chart?vs_currency=usd&days=7`
        ),
      ]);
      const response = await Promise.all(requests);
      if (mounted) {
        const responseData: TokenPriceData[] = response.map((r, i) => {
          const data = r.data;
          return {
            token: tokens[i],
            prices: data?.prices || [],
          };
        });
        setTokenPriceData(responseData);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [lendingPairs]);

  const combinedBalances: TokenBalance[] = useMemo(() => {
    const combined = lendingPairs.flatMap((pair, i) => {
      const token0Quote = tokenQuotes.find(
        (quote) => quote.token.address === (pair.token0?.referenceAddress || pair.token0.address)
      );
      const token1Quote = tokenQuotes.find(
        (quote) => quote.token.address === (pair.token1?.referenceAddress || pair.token1.address)
      );
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

  const totalBalance = useMemo(() => {
    return combinedBalances.reduce((acc, balance) => acc + balance.balanceUSD, 0);
  }, [combinedBalances]);
  return (
    <AppPage>
      <Container>
        <div className='flex flex-col gap-6 max-w-screen-2xl m-auto'>
          <div className='flex flex-col items-center'>
            <Text size='L' weight='bold' color='rgba(130, 160, 182, 1)'>
              YOUR PORTFOLIO
            </Text>
            <Display size='L' weight='semibold'>
              {formatUSD(totalBalance)}
            </Display>
          </div>
          <AssetBar combinedBalances={combinedBalances} tokenColors={tokenColors} setActiveAsset={setActiveAsset} />
          <div className='flex justify-between gap-4'>
            <OutlinedWhiteButtonWithIcon size='M' Icon={<DollarIcon />} svgColorType='stroke' position='leading'>
              Buy Crypto
            </OutlinedWhiteButtonWithIcon>
            <OutlinedWhiteButtonWithIcon size='M' Icon={<SendIcon />} svgColorType='stroke' position='leading'>
              Send Crypto
            </OutlinedWhiteButtonWithIcon>
            <OutlinedWhiteButtonWithIcon size='M' Icon={<TrendingUpIcon />} svgColorType='stroke' position='leading'>
              Earn Interest
            </OutlinedWhiteButtonWithIcon>
            <OutlinedWhiteButtonWithIcon size='M' Icon={<ShareIcon />} svgColorType='stroke' position='leading'>
              Withdraw
            </OutlinedWhiteButtonWithIcon>
          </div>
          <PortfolioGrid
            balances={combinedBalances}
            activeAsset={activeAsset}
            tokenQuotes={tokenQuotes}
            tokenPriceData={tokenPriceData}
          />
          <LendingPairPeerCard />
        </div>
      </Container>
      <WelcomeModal
        open={showWelcomeModal}
        setOpen={setShowWelcomeModal}
        onConfirm={() => {
          localStorage.setItem(WELCOME_MODAL_LOCAL_STORAGE_KEY, WELCOME_MODAL_LOCAL_STORAGE_VALUE);
        }}
      />
    </AppPage>
  );
}
