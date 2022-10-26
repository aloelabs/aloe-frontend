import { useEffect, useMemo, useState } from 'react';

import axios, { AxiosResponse } from 'axios';
import AppPage from 'shared/lib/components/common/AppPage';
import { OutlinedWhiteButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { MultiDropdownOption } from 'shared/lib/components/common/Dropdown';
import { ItemsPerPage } from 'shared/lib/components/common/Pagination';
import { Text, Display } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';
import { chain, useAccount, useEnsName, useProvider } from 'wagmi';

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

const FAKE_DATA = [
  {
    token: GetTokenData('0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6'),
    percentage: 0.5,
    color: 'rgb(140,140,140)',
  },
  {
    token: GetTokenData('0xad5efe0d12c1b3fe87a171c83ce4cca4d85d381a'),
    percentage: 0.4,
    color: 'rgb(40, 120, 200)',
  },
  {
    token: GetTokenData('0x886055958cdf2635ff47a2071264a3413d26f959'),
    percentage: 0.1,
    color: 'rgb(239, 147, 0)',
  },
];

const WELCOME_MODAL_LOCAL_STORAGE_KEY = 'acknowledged-welcome-modal-lend';
const WELCOME_MODAL_LOCAL_STORAGE_VALUE = 'acknowledged';

const LEND_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const Container = styled.div`
  max-width: 900px;
  margin: 0 auto;
`;

const LendHeaderContainer = styled.div`
  display: grid;
  grid-template-columns: 3fr 2fr;
  height: 300px;
`;

const LendHeader = styled.div`
  ${tw`flex flex-col justify-between`}
`;

const LowerLendHeader = styled.div`
  display: flex;
  align-items: center;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    flex-direction: column-reverse;
    align-items: flex-start;
  }
`;

const LendCards = styled.div`
  ${tw`flex flex-col`}
  row-gap: 24px;
  margin-top: 24px;
`;

export type TokenQuote = {
  token: TokenData;
  price: number;
};

export type TokenBalance = {
  token: TokenData;
  balance: number;
  balanceUSD: number;
  isKitty: boolean;
  apy: number;
  pairName: string;
  otherToken: TokenData;
};

type TokenColor = {
  token: TokenData;
  color: string;
};

const filterOptions: MultiDropdownOption[] = getTokens().map((token) => {
  return {
    value: token.address,
    label: token.ticker,
    icon: token.iconPath,
  } as MultiDropdownOption;
});

export default function PortfolioPage() {
  // MARK: component state
  const [tokenQuotes, setTokenQuotes] = useState<TokenQuote[]>([]);
  const [lendingPairs, setLendingPairs] = useState<LendingPair[]>([]);
  const [lendingPairBalances, setLendingPairBalances] = useState<LendingPairBalances[]>([]);
  const [tokenColors, setTokenColors] = useState<Map<string, string>>(new Map());
  const [activeAsset, setActiveAsset] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // MARK: wagmi hooks
  const provider = useProvider({ chainId: chain.goerli.id });
  const { address } = useAccount();
  const { data: ensName } = useEnsName({
    address: address,
    chainId: chain.mainnet.id,
  });

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

  console.log('tokenColors', tokenColors);

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
  }, [provider, address]);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (!address) return;
      const results = await Promise.all(lendingPairs.map((p) => getLendingPairBalances(p, address, provider)));
      if (mounted) {
        setLendingPairBalances(results);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [provider, address, lendingPairs]);

  const combinedBalances: TokenBalance[] = useMemo(() => {
    if (tokenQuotes.length === 0) {
      return [];
    }
    let combined = lendingPairs.flatMap((pair, i) => {
      const token0Quote = tokenQuotes.find(
        (quote) => quote.token.address === (pair.token0?.referenceAddress || pair.token0.address)
      );
      const token1Quote = tokenQuotes.find(
        (quote) => quote.token.address === (pair.token1?.referenceAddress || pair.token1.address)
      );
      const token0Price = token0Quote?.price || 0;
      const token1Price = token1Quote?.price || 0;
      const pairName = `${pair.token0.ticker}-${pair.token1.ticker}`;
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
    // We don't want to show duplicate tokens
    combined.forEach((balance) => {
      const existing = distinct.find((d) => d.token.referenceAddress === balance.token.referenceAddress);
      if (!existing) {
        distinct.push(balance);
      }
    });
    return distinct;
  }, [lendingPairBalances, lendingPairs, tokenQuotes]);

  const combinedBalances2: TokenBalance[] = useMemo(() => {
    if (tokenQuotes.length === 0) {
      return [];
    }
    let combined = lendingPairs.flatMap((pair, i) => {
      const token0Quote = tokenQuotes.find(
        (quote) => quote.token.address === (pair.token0?.referenceAddress || pair.token0.address)
      );
      const token1Quote = tokenQuotes.find(
        (quote) => quote.token.address === (pair.token1?.referenceAddress || pair.token1.address)
      );
      const token0Price = token0Quote?.price || 0;
      const token1Price = token1Quote?.price || 0;
      const pairName = `${pair.token0.ticker}-${pair.token1.ticker}`;
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
    // We don't want to show duplicate tokens
    combined.forEach((balance) => {
      const existing = distinct.find((d) => d.token.address === balance.token.address);
      if (!existing) {
        distinct.push(balance);
      }
    });
    return distinct;
  }, [lendingPairBalances, lendingPairs, tokenQuotes]);

  const totalBalance = useMemo(() => {
    return combinedBalances2.reduce((acc, balance) => acc + balance.balanceUSD, 0);
  }, [combinedBalances2]);
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
          <AssetBar
            items={FAKE_DATA}
            combinedBalances={combinedBalances}
            tokenColors={tokenColors}
            setActiveAsset={setActiveAsset}
          />
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
          <PortfolioGrid balances={combinedBalances2} activeAsset={activeAsset} tokenQuotes={tokenQuotes} />
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
