import { useContext, useEffect, useMemo, useState } from 'react';

import { Address, SendTransactionResult } from '@wagmi/core';
import axios, { AxiosResponse } from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text, Display } from 'shared/lib/components/common/Typography';
import {
  getSessionStorageInteger,
  getSessionStorageString,
  setSessionStorageInteger,
  setSessionStorageString,
} from 'shared/lib/util/SessionStorage';
import styled from 'styled-components';
import { useAccount, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import { ReactComponent as InfoIcon } from '../assets/svg/info.svg';
import { ReactComponent as SendIcon } from '../assets/svg/send.svg';
import { ReactComponent as ShareIcon } from '../assets/svg/share.svg';
import { ReactComponent as TrendingUpIcon } from '../assets/svg/trending_up.svg';
import { ReactComponent as UsersIcon } from '../assets/svg/users.svg';
import { AssetBar } from '../components/portfolio/AssetBar';
import { AssetBarPlaceholder } from '../components/portfolio/AssetBarPlaceholder';
import LendingPairPeerCard from '../components/portfolio/LendingPairPeerCard';
import EarnInterestModal from '../components/portfolio/modal/EarnInterestModal';
import PendingTxnModal, { PendingTxnModalStatus } from '../components/portfolio/modal/PendingTxnModal';
import ReferralModal from '../components/portfolio/modal/ReferralModal';
import SendCryptoModal from '../components/portfolio/modal/SendCryptoModal';
import WithdrawModal from '../components/portfolio/modal/WithdrawModal';
import PortfolioActionButton from '../components/portfolio/PortfolioActionButton';
import PortfolioBalance from '../components/portfolio/PortfolioBalance';
import PortfolioGrid from '../components/portfolio/PortfolioGrid';
import PortfolioPageWidgetWrapper from '../components/portfolio/PortfolioPageWidgetWrapper';
import { RESPONSIVE_BREAKPOINT_SM, RESPONSIVE_BREAKPOINT_XS } from '../data/constants/Breakpoints';
import { API_PRICE_RELAY_CONSOLIDATED_URL } from '../data/constants/Values';
import {
  getAvailableLendingPairs,
  getLendingPairBalances,
  LendingPair,
  LendingPairBalances,
} from '../data/LendingPair';
import { PriceRelayConsolidatedResponse } from '../data/PriceRelayResponse';
import { Token } from '../data/Token';
import { getToken, getTokenByTicker } from '../data/TokenData';
import { getProminentColor } from '../util/Colors';

const ASSET_BAR_TOOLTIP_TEXT = `This bar shows the assets in your portfolio. 
  Hover/click on a segment to see more details.`;
const PORTFOLIO_GRID_TOOLTIP_TEXT = `These widgets give you general information about an asset.`;
const LENDING_PAIR_PEER_CARD_TOOLTIP_TEXT = `The asset you've selected may be available in multiple lending pairs. Use
  this dropdown to see its stats in a particular pair.`;

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
  row-gap: 16px;
  margin-top: 20px;
  overflow-x: auto;
  white-space: nowrap;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    grid-template-columns: 1fr;
  }
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

export type ReferralData = {
  courierId: number;
  lender: Token;
};

export default function PortfolioPage() {
  const { activeChain } = useContext(ChainContext);
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
  const [isSendCryptoModalOpen, setIsSendCryptoModalOpen] = useState(false);
  const [isEarnInterestModalOpen, setIsEarnInterestModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useState(false);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);
  const [sessionReferrer, setSessionReferrer] = useState<ReferralData | null>(null);
  const [searchParams] = useSearchParams();

  const provider = useProvider({ chainId: activeChain.id });
  const { address, isConnecting, isConnected } = useAccount();
  const navigate = useNavigate();

  const uniqueTokens = useMemo(() => {
    const tokens = new Set<Token>();
    lendingPairs.forEach((pair) => {
      tokens.add(pair.token0);
      tokens.add(pair.token1);
    });
    return Array.from(tokens);
  }, [lendingPairs]);

  const kitties = useMemo(() => {
    return lendingPairs.flatMap((pair) => [pair.kitty0, pair.kitty1]);
  }, [lendingPairs]);

  /**
   * Handle referral search param
   */
  useEffect(() => {
    const existingSessionReferrer = getSessionStorageInteger('referrer');
    const existingSessionLenderAddress = getSessionStorageString('lender');
    if (searchParams.has('ref') && searchParams.has('lender') && kitties.length > 0) {
      const referrer = parseInt(searchParams.get('ref') ?? '');
      const lenderAddress = searchParams.get('lender');
      const lender = kitties.find((kitty) => kitty.address === lenderAddress) ?? null;
      if (referrer > 0 && lender != null) {
        setSessionReferrer({
          courierId: referrer,
          lender,
        });
        setSessionStorageInteger('referrer', referrer);
        setSessionStorageString('lender', lender.address);
      }
    } else if (existingSessionReferrer != null && existingSessionLenderAddress != null) {
      const existingSessionLender = getToken(activeChain.id, existingSessionLenderAddress as Address);
      if (existingSessionLender == null) {
        return;
      }
      setSessionReferrer({
        courierId: existingSessionReferrer,
        lender: existingSessionLender,
      });
    }
  }, [activeChain.id, searchParams, kitties]);

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
          token: getTokenByTicker(activeChain.id, ticker),
          price: data.price,
        };
      });
      const tokenPriceData: TokenPriceData[] = Object.entries(historicalPriceResponse).map(([ticker, data]) => {
        return {
          token: getTokenByTicker(activeChain.id, ticker),
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
  }, [activeChain, uniqueTokens]);

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
      const results = await getAvailableLendingPairs(activeChain, provider);
      if (mounted) {
        setLendingPairs(results);
        setIsLoading(false);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [activeChain, provider]);

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
      setPendingTxnModalStatus(PendingTxnModalStatus.PENDING);
      setIsPendingTxnModalOpen(true);
      const receipt = await pendingTxn.wait();
      if (!mounted) return;
      if (receipt.status === 1) {
        setPendingTxnModalStatus(PendingTxnModalStatus.SUCCESS);
      } else {
        setPendingTxnModalStatus(PendingTxnModalStatus.FAILURE);
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

  const apyWeightedAverage = useMemo(() => {
    if (totalBalanceUSD === 0) return 0;
    const acc = combinedBalances.reduce((acc, balance) => acc + balance.apy * balance.balanceUSD, 0);
    return acc / totalBalanceUSD;
  }, [combinedBalances, totalBalanceUSD]);

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
          <PortfolioBalance
            errorLoadingPrices={errorLoadingPrices}
            totalUsd={totalBalanceUSD}
            weightedAvgApy={apyWeightedAverage}
          />
        </div>

        <div className='h-16'>
          <PortfolioPageWidgetWrapper tooltip={ASSET_BAR_TOOLTIP_TEXT} tooltipId='assetBar'>
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
          </PortfolioPageWidgetWrapper>
        </div>
        <PortfolioActionButtonsContainer>
          <PortfolioActionButton
            label={'Send Crypto'}
            Icon={<SendIcon />}
            onClick={() => setIsSendCryptoModalOpen(true)}
          />
          <PortfolioActionButton
            label={'Deposit'}
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
          <PortfolioActionButton label={'Referral'} Icon={<UsersIcon />} onClick={() => setIsReferralModalOpen(true)} />
        </PortfolioActionButtonsContainer>
        <div className='mt-10'>
          <PortfolioPageWidgetWrapper tooltip={PORTFOLIO_GRID_TOOLTIP_TEXT} tooltipId='portfolioGrid'>
            <PortfolioGrid
              activeAsset={activeAsset}
              balances={combinedBalances}
              tokenColors={tokenColors}
              tokenPriceData={tokenPriceData}
              tokenQuotes={tokenQuotes}
              errorLoadingPrices={errorLoadingPrices}
            />
          </PortfolioPageWidgetWrapper>
        </div>
        {isDoneLoading && filteredLendingPairs.length > 0 && activeAsset != null && (
          <div className='mt-10'>
            <PortfolioPageWidgetWrapper tooltip={LENDING_PAIR_PEER_CARD_TOOLTIP_TEXT} tooltipId='lendingPairPeerCard'>
              <LendingPairPeerCard activeAsset={activeAsset} lendingPairs={filteredLendingPairs} />
            </PortfolioPageWidgetWrapper>
          </div>
        )}
        <div className='flex justify-center items-center gap-1 w-full mt-10'>
          <InfoIcon width={16} height={16} />
          <Text size='S' color='rgba(130, 160, 182, 1)'>
            Hint: Click the space bar at any time to access search and shortcuts.
          </Text>
        </div>
      </Container>
      {activeAsset != null && (
        <>
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
            referralData={sessionReferrer}
            setIsOpen={setIsEarnInterestModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <WithdrawModal
            options={uniqueTokens}
            defaultOption={activeAsset}
            lendingPairs={lendingPairs}
            isOpen={isWithdrawModalOpen}
            setIsOpen={setIsWithdrawModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <ReferralModal
            options={lendingPairs}
            defaultOption={lendingPairs[0]}
            isOpen={isReferralModalOpen}
            setIsOpen={setIsReferralModalOpen}
          />
        </>
      )}
      <PendingTxnModal
        isOpen={isPendingTxnModalOpen}
        txnHash={pendingTxn?.hash}
        setIsOpen={(isOpen: boolean) => {
          setIsPendingTxnModalOpen(isOpen);
          if (!isOpen) {
            setPendingTxn(null);
          }
        }}
        onConfirm={() => {
          setIsPendingTxnModalOpen(false);
          setTimeout(() => {
            navigate(0);
          }, 100);
        }}
        status={pendingTxnModalStatus}
      />
    </AppPage>
  );
}
