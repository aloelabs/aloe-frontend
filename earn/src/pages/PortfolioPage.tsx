import { useEffect, useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import axios, { AxiosResponse } from 'axios';
import { useNavigate } from 'react-router-dom';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import useChain from 'shared/lib/data/hooks/UseChain';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { Token } from 'shared/lib/data/Token';
import { getTokenBySymbol } from 'shared/lib/data/TokenData';
import styled from 'styled-components';
import { Config, useAccount, useClient, usePublicClient } from 'wagmi';

import { ReactComponent as InfoIcon } from '../assets/svg/info.svg';
import { ReactComponent as SendIcon } from '../assets/svg/send.svg';
import { ReactComponent as ShareIcon } from '../assets/svg/share.svg';
import { ReactComponent as TrendingUpIcon } from '../assets/svg/trending_up.svg';
import { ReactComponent as TruckIcon } from '../assets/svg/truck.svg';
import PendingTxnModal, { PendingTxnModalStatus } from '../components/common/PendingTxnModal';
import { AssetBar } from '../components/portfolio/AssetBar';
import { AssetBarPlaceholder } from '../components/portfolio/AssetBarPlaceholder';
import LendingPairPeerCard from '../components/portfolio/LendingPairPeerCard';
import BridgeModal from '../components/portfolio/modal/BridgeModal';
import EarnInterestModal from '../components/portfolio/modal/EarnInterestModal';
import SendCryptoModal from '../components/portfolio/modal/SendCryptoModal';
import WithdrawModal from '../components/portfolio/modal/WithdrawModal';
import PortfolioActionButton from '../components/portfolio/PortfolioActionButton';
import PortfolioBalance from '../components/portfolio/PortfolioBalance';
import PortfolioGrid from '../components/portfolio/PortfolioGrid';
import PortfolioPageWidgetWrapper from '../components/portfolio/PortfolioPageWidgetWrapper';
import { RESPONSIVE_BREAKPOINT_SM, RESPONSIVE_BREAKPOINT_XS } from '../data/constants/Breakpoints';
import { API_PRICE_RELAY_CONSOLIDATED_URL } from '../data/constants/Values';
import { useLendingPairs } from '../data/hooks/UseLendingPairs';
import { getLendingPairBalances, LendingPairBalances } from '../data/LendingPair';
import { PriceRelayConsolidatedResponse } from '../data/PriceRelayResponse';
import { getProminentColor } from '../util/Colors';
import { useEthersProvider } from '../util/Provider';

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
  border: 1px solid ${GREY_700};
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
  token?: Token;
  price: number;
};

export type TokenPriceData = {
  token?: Token;
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
  const activeChain = useChain();

  const [pendingTxn, setPendingTxn] = useState<WriteContractReturnType | null>(null);
  const [tokenColors, setTokenColors] = useState<Map<string, string>>(new Map());
  const [tokenQuotes, setTokenQuotes] = useChainDependentState<TokenQuote[]>([], activeChain.id);
  const [lendingPairBalances, setLendingPairBalances] = useChainDependentState<LendingPairBalances[]>(
    [],
    activeChain.id
  );
  const [tokenPriceData, setTokenPriceData] = useState<TokenPriceData[]>([]);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [errorLoadingPrices, setErrorLoadingPrices] = useState(false);
  const [activeAsset, setActiveAsset] = useState<Token | null>(null);
  const [isSendCryptoModalOpen, setIsSendCryptoModalOpen] = useState(false);
  const [isEarnInterestModalOpen, setIsEarnInterestModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useState(false);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);

  const { isLoading, lendingPairs } = useLendingPairs(activeChain.id);
  const client = useClient<Config>({ chainId: activeChain.id });
  const provider = useEthersProvider(client);
  const { address, isConnecting, isConnected } = useAccount();
  const navigate = useNavigate();

  useEffect(() => {
    setIsLoadingPrices(true);
  }, [activeChain.id, setIsLoadingPrices]);

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
    (async () => {
      // Only fetch prices for tokens if they are all on the same (active) chain
      if (uniqueTokens.length > 0 && uniqueTokens.some((token) => token.chainId !== activeChain.id)) {
        return;
      }
      const symbols = uniqueTokens
        .map((token) => token?.symbol)
        .filter((symbol) => symbol !== undefined)
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
      const tokenQuoteData: TokenQuote[] = Object.entries(latestPriceResponse).map(([symbol, data]) => {
        return {
          token: getTokenBySymbol(activeChain.id, symbol),
          price: data.price,
        };
      });
      const tokenPriceData: TokenPriceData[] = Object.entries(historicalPriceResponse).map(([symbol, data]) => {
        return {
          token: getTokenBySymbol(activeChain.id, symbol),
          priceEntries: data.prices,
        };
      });
      setTokenQuotes(tokenQuoteData);
      setTokenPriceData(tokenPriceData);
      setIsLoadingPrices(false);
    })();
  }, [activeChain, uniqueTokens, setTokenQuotes, setTokenPriceData, setIsLoadingPrices, setErrorLoadingPrices]);

  useEffect(() => {
    (async () => {
      const tokenColorMap: Map<string, string> = new Map();
      const colorPromises = uniqueTokens.map((token) => getProminentColor(token.logoURI || ''));
      const colors = await Promise.all(colorPromises);
      uniqueTokens.forEach((token: Token, index: number) => {
        tokenColorMap.set(token.address, colors[index]);
      });
      setTokenColors(tokenColorMap);
    })();
  }, [lendingPairs, setTokenColors, uniqueTokens]);

  useEffect(() => {
    (async () => {
      // Checking for loading rather than number of pairs as pairs could be empty even if loading is false
      if (!address || !provider || isLoading) return;
      const { lendingPairBalances: results } = await getLendingPairBalances(
        lendingPairs,
        address,
        provider,
        activeChain.id
      );
      setLendingPairBalances(results);
    })();
  }, [activeChain.id, address, isLoading, lendingPairs, provider, setLendingPairBalances]);

  const publicClient = usePublicClient({ chainId: activeChain.id });
  useEffect(() => {
    (async () => {
      if (!pendingTxn || !publicClient) return;
      setPendingTxnModalStatus(PendingTxnModalStatus.PENDING);
      setIsPendingTxnModalOpen(true);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: pendingTxn,
      });
      if (receipt.status === 'success') {
        setPendingTxnModalStatus(PendingTxnModalStatus.SUCCESS);
      } else {
        setPendingTxnModalStatus(PendingTxnModalStatus.FAILURE);
      }
    })();
  }, [publicClient, pendingTxn, setIsPendingTxnModalOpen, setPendingTxnModalStatus]);

  useEffect(() => {
    if (!isConnected && !isConnecting && lendingPairBalances.length > 0) {
      setLendingPairBalances([]);
      setActiveAsset(null);
    }
  }, [isConnecting, isConnected, lendingPairBalances, setLendingPairBalances]);

  const combinedBalances: TokenBalance[] = useMemo(() => {
    const combined = lendingPairs.flatMap((pair, i) => {
      const token0Quote = tokenQuotes.find((quote) => quote.token?.address === pair.token0.address);
      const token1Quote = tokenQuotes.find((quote) => quote.token?.address === pair.token1.address);
      const token0Price = token0Quote?.price || 0;
      const token1Price = token1Quote?.price || 0;
      const pairName: string = `${pair.token0.symbol}-${pair.token1.symbol}`;
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
          apy: pair.kitty0Info.lendAPY * 100,
          isKitty: true,
          pairName,
          otherToken: pair.token1,
        },
        {
          token: pair.kitty1,
          balance: lendingPairBalances?.[i]?.kitty1Balance || 0,
          balanceUSD: (lendingPairBalances?.[i]?.kitty1Balance || 0) * token1Price,
          apy: pair.kitty1Info.lendAPY * 100,
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
                    ignoreBalances={true}
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
            onClick={() => {
              if (isConnected) setIsSendCryptoModalOpen(true);
            }}
          />
          <PortfolioActionButton
            label={'Deposit'}
            Icon={<TrendingUpIcon />}
            onClick={() => {
              if (isConnected) setIsEarnInterestModalOpen(true);
            }}
          />
          <PortfolioActionButton
            label={'Withdraw'}
            Icon={<ShareIcon />}
            onClick={() => {
              if (isConnected) setIsWithdrawModalOpen(true);
            }}
          />
          <PortfolioActionButton
            label={'Bridge'}
            Icon={<TruckIcon />}
            onClick={() => {
              if (isConnected) setIsBridgeModalOpen(true);
            }}
          />
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
            Hint: Click the space bar at any time to search for an asset.
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
            setIsOpen={setIsEarnInterestModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <WithdrawModal
            tokens={uniqueTokens}
            defaultToken={activeAsset}
            lendingPairs={lendingPairs}
            tokenBalances={combinedBalances}
            isOpen={isWithdrawModalOpen}
            setIsOpen={setIsWithdrawModalOpen}
            setPendingTxn={setPendingTxn}
          />
          <BridgeModal isOpen={isBridgeModalOpen} selectedAsset={activeAsset} setIsOpen={setIsBridgeModalOpen} />
        </>
      )}
      <PendingTxnModal
        isOpen={isPendingTxnModalOpen}
        txnHash={pendingTxn}
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
