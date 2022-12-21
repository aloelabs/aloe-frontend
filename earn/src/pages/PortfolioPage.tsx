import { useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import axios, { AxiosResponse } from 'axios';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text, Display } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { chain, useAccount, useNetwork, useProvider } from 'wagmi';

import { ReactComponent as DollarIcon } from '../assets/svg/dollar.svg';
import { ReactComponent as SendIcon } from '../assets/svg/send.svg';
import { ReactComponent as ShareIcon } from '../assets/svg/share.svg';
import { ReactComponent as TrendingUpIcon } from '../assets/svg/trending_up.svg';
import PendingTxnModal from '../components/lend/modal/PendingTxnModal';
import { AssetBar } from '../components/portfolio/AssetBar';
import { AssetBarPlaceholder } from '../components/portfolio/AssetBarPlaceholder';
import LendingPairPeerCard from '../components/portfolio/LendingPairPeerCard';
import BorrowCryptoModal from '../components/portfolio/modal/BorrowCryptoModal';
import EarnInterestModal from '../components/portfolio/modal/EarnInterestModal';
import SendCryptoModal from '../components/portfolio/modal/SendCryptoModal';
import WithdrawModal from '../components/portfolio/modal/WithdrawModal';
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
import { Token } from '../data/Token';
import { getTokenByTicker } from '../data/TokenData';
import { getProminentColor } from '../util/Colors';
import { formatUSD } from '../util/Numbers';

const Container = styled.div`
  max-width: 780px;
  margin: 0 auto;
`;

const EmptyAssetBar = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 56px;
  background-color: transparent;
  border: 1px solid rgba(26, 41, 52, 1);
  border-radius: 8px;
`;

const PortfolioActionButtonsContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  column-gap: 16px;
  margin-top: 20px;
  overflow-x: auto;
  white-space: nowrap;
`;

export type PriceEntry = {
  price: number;
  timestamp: number;
};

export type TokenQuote = {
  token: Token;
  price: number;
};

export type TokenPriceData = {
  token: Token;
  priceEntries: PriceEntry[];
};

export type TokenBalance = {
  token: Token;
  balance: number;
  balanceUSD: number;
  apy: number;
  isKitty: boolean;
  pairName: string;
};

export default function PortfolioPage() {
  const [pendingTxn, setPendingTxn] = useState<SendTransactionResult | null>(null);
  const [tokenColors, setTokenColors] = useState<Map<string, string>>(new Map());
  const [tokenQuotes, setTokenQuotes] = useState<TokenQuote[]>([]);
  const [lendingPairs, setLendingPairs] = useState<LendingPair[]>([]);
  const [lendingPairBalances, setLendingPairBalances] = useState<LendingPairBalances[]>([]);
  const [tokenPriceData, setTokenPriceData] = useState<TokenPriceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [errorLoadingPrices, setErrorLoadingPrices] = useState(false);
  const [activeAsset, setActiveAsset] = useState<Token | null>(null);
  const [isBorrowCryptoModalOpen, setIsBorrowCryptoModalOpen] = useState(false);
  const [isSendCryptoModalOpen, setIsSendCryptoModalOpen] = useState(false);
  const [isEarnInterestModalOpen, setIsEarnInterestModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useState(false);

  const network = useNetwork();
  const activeChainId = network.chain?.id || chain.goerli.id;
  const provider = useProvider({ chainId: activeChainId });
  const { address, isConnecting, isConnected } = useAccount();

  const uniqueTokens = useMemo(() => {
    const tokens = new Set<Token>();
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
          token: getTokenByTicker(activeChainId, ticker),
          price: data.price,
        };
      });
      const tokenPriceData: TokenPriceData[] = Object.entries(historicalPriceResponse).map(([ticker, data]) => {
        return {
          token: getTokenByTicker(activeChainId, ticker),
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
  }, [activeChainId, uniqueTokens]);

  useEffect(() => {
    let mounted = true;
    async function fetchTokenColors() {
      const tokenColorMap: Map<string, string> = new Map();
      const colorPromises = uniqueTokens.map((token) => getProminentColor(token.iconPath || ''));
      const colors = await Promise.all(colorPromises);
      uniqueTokens.forEach((token: Token, index: number) => {
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
      const results = await getAvailableLendingPairs(activeChainId, provider);
      if (mounted) {
        setLendingPairs(results);
        setIsLoading(false);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [activeChainId, provider]);

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
    async function waitForTxn() {
      if (!pendingTxn) return;
      setIsPendingTxnModalOpen(true);
      const receipt = await pendingTxn.wait();
      if (!mounted) return;
      setPendingTxn(null);
      setIsPendingTxnModalOpen(false);
      if (receipt.status === 1) {
        // TODO: Update balances
        // TODO: Show success modal
      } else {
        // TODO: Show failure modal
      }
    }
    waitForTxn();
    return () => {
      mounted = false;
    };
  }, [pendingTxn]);

  const combinedBalances: TokenBalance[] = useMemo(() => {
    const combined = lendingPairs.flatMap((pair, i) => {
      const token0Quote = tokenQuotes.find((quote) => quote.token.address === pair.token0.address);
      const token1Quote = tokenQuotes.find((quote) => quote.token.address === pair.token1.address);
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
    const activeAddress = activeAsset.address;
    return lendingPairs.filter((pair) => {
      const token0Address = pair.token0.address;
      const token1Address = pair.token1.address;
      return token0Address === activeAddress || token1Address === activeAddress;
    });
  }, [lendingPairs, activeAsset]);

  const noWallet = !isConnecting && !isConnected;
  const isDoneLoading = !isLoadingPrices && (!isLoading || !noWallet);

  return (
    <AppPage>
      <Container>
        <div className='flex flex-col items-center mb-14'>
          <Text size='L' weight='bold' color='rgba(130, 160, 182, 1)'>
            YOUR PORTFOLIO
          </Text>
          <Display size='L' weight='semibold'>
            {errorLoadingPrices ? '$□□□' : formatUSD(totalBalanceUSD)}
          </Display>
        </div>
        <div className='h-16'>
          {(() => {
            if (!isDoneLoading) return <AssetBarPlaceholder />;
            else if (!isConnected)
              return (
                <EmptyAssetBar>
                  <Text size='L' weight='medium' color='rgba(130, 160, 182, 1)'>
                    Please connect your wallet to get started
                  </Text>
                </EmptyAssetBar>
              );
            else if (totalBalanceUSD > 0 || errorLoadingPrices)
              return (
                <AssetBar
                  balances={combinedBalances}
                  tokenColors={tokenColors}
                  ignoreBalances={errorLoadingPrices}
                  setActiveAsset={(updatedAsset: Token) => {
                    setActiveAsset(updatedAsset);
                  }}
                />
              );
            else
              return (
                <EmptyAssetBar>
                  <Text size='L' weight='medium' color='rgba(130, 160, 182, 1)'>
                    No assets found
                  </Text>
                </EmptyAssetBar>
              );
          })()}
        </div>
        <PortfolioActionButtonsContainer>
          <PortfolioActionButton
            label={'Send Crypto'}
            Icon={<SendIcon />}
            onClick={() => setIsSendCryptoModalOpen(true)}
          />
          <PortfolioActionButton
            label={'Earn Interest'}
            Icon={<TrendingUpIcon />}
            onClick={() => setIsEarnInterestModalOpen(true)}
          />
          <PortfolioActionButton
            label={'Withdraw'}
            Icon={<ShareIcon />}
            onClick={() => {
              setIsWithdrawModalOpen(true);
            }}
          />
          <PortfolioActionButton
            label={'Borrow Crypto'}
            Icon={<DollarIcon />}
            onClick={() => setIsBorrowCryptoModalOpen(true)}
            disabled={true}
          />
        </PortfolioActionButtonsContainer>
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
          <div className='mt-10'>
            <LendingPairPeerCard activeAsset={activeAsset} lendingPairs={filteredLendingPairs} />
          </div>
        )}
      </Container>
      {activeAsset != null && (
        <>
          <BorrowCryptoModal
            options={uniqueTokens}
            defaultOption={activeAsset}
            lendingPairs={lendingPairs}
            tokenQuotes={tokenQuotes}
            isOpen={isBorrowCryptoModalOpen}
            setIsOpen={setIsBorrowCryptoModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <SendCryptoModal
            options={uniqueTokens}
            defaultOption={activeAsset}
            isOpen={isSendCryptoModalOpen}
            setIsOpen={setIsSendCryptoModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <EarnInterestModal
            options={uniqueTokens}
            defaultOption={activeAsset}
            lendingPairs={lendingPairs}
            isOpen={isEarnInterestModalOpen}
            setIsOpen={setIsEarnInterestModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <WithdrawModal
            options={uniqueTokens}
            defaultOption={activeAsset}
            lendingPairs={lendingPairs}
            combinedBalances={combinedBalances}
            isOpen={isWithdrawModalOpen}
            setIsOpen={setIsWithdrawModalOpen}
            setPendingTxn={setPendingTxn}
          />
        </>
      )}
      <PendingTxnModal open={isPendingTxnModalOpen} txnHash={pendingTxn?.hash} setOpen={setIsPendingTxnModalOpen} />
    </AppPage>
  );
}
