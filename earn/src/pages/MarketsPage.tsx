import { useContext, useEffect, useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import axios, { AxiosResponse } from 'axios';
import { useSearchParams } from 'react-router-dom';
import AppPage from 'shared/lib/components/common/AppPage';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { getChainLogo } from 'shared/lib/data/constants/ChainSpecific';
import { GREY_400, GREY_600 } from 'shared/lib/data/constants/Colors';
import { GetNumericFeeTier } from 'shared/lib/data/FeeTier';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { Token } from 'shared/lib/data/Token';
import { formatUSDAuto } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { Address } from 'viem';
import { Config, useAccount, useBlockNumber, useClient, usePublicClient } from 'wagmi';

import { ChainContext } from '../App';
import PendingTxnModal, { PendingTxnModalStatus } from '../components/common/PendingTxnModal';
import BorrowingWidget from '../components/markets/borrow/BorrowingWidget';
import LiquidateTab from '../components/markets/liquidate/LiquidateTab';
import InfoTab from '../components/markets/monitor/InfoTab';
import SupplyTable, { SupplyTableRow } from '../components/markets/supply/SupplyTable';
import { BorrowerNftBorrower, fetchListOfFuse2BorrowNfts } from '../data/BorrowerNft';
import { ZERO_ADDRESS } from '../data/constants/Addresses';
import { API_PRICE_RELAY_LATEST_URL } from '../data/constants/Values';
import { useLendingPairs } from '../data/hooks/UseLendingPairs';
import { getLendingPairBalances, LendingPairBalancesMap } from '../data/LendingPair';
import { fetchBorrowerDatas, UniswapPoolInfo } from '../data/MarginAccount';
import { PriceRelayLatestResponse } from '../data/PriceRelayResponse';
import { getProminentColor } from '../util/Colors';
import { useEthersProvider } from '../util/Provider';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const SELECTED_TAB_KEY = 'selectedTab';

const HeaderDividingLine = styled.hr`
  color: ${GREY_600};
  height: 1px;
`;

const HeaderSegmentedControlOption = styled.button.attrs((props: { isActive: boolean }) => props)`
  padding: 16px;
  cursor: pointer;
  color: ${(props) => (props.isActive ? 'white' : GREY_400)};

  &:hover {
    color: white;
  }

  position: relative;
  &:after {
    position: absolute;
    content: ${(props) => (props.isActive ? "''" : 'none')};
    background-color: white;

    top: 100%;
    left: 0px;
    width: 100%;
    height: 1px;
  }
`;

export type TokenBalance = {
  token: Token;
  balance: number;
  balanceUSD: number;
  isKitty: boolean;
  apy: number;
  pairName: string;
};

enum TabOption {
  Supply = 'supply',
  Borrow = 'borrow',
  Monitor = 'monitor',
  Liquidate = 'liquidate',
}

type TokenSymbol = string;
type Quote = number;

export default function MarketsPage() {
  const { activeChain } = useContext(ChainContext);
  // MARK: component state
  const [tokenQuotes, setTokenQuotes] = useChainDependentState<Map<TokenSymbol, Quote>>(new Map(), activeChain.id);
  const [balancesMap, setBalancesMap] = useChainDependentState<LendingPairBalancesMap>(new Map(), activeChain.id);
  const [borrowers, setBorrowers] = useChainDependentState<BorrowerNftBorrower[] | null>(null, activeChain.id);
  const [tokenColors, setTokenColors] = useChainDependentState<Map<Address, string>>(new Map(), activeChain.id);
  const [pendingTxn, setPendingTxn] = useState<WriteContractReturnType | null>(null);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useState(false);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const selectedTab = useMemo(() => {
    const tabSearchParam = searchParams.get(SELECTED_TAB_KEY)?.toLowerCase();
    if (tabSearchParam != null) {
      // Check if the search param is a valid tab (case insensitive)
      if (Object.values(TabOption).includes(tabSearchParam.toLowerCase() as TabOption)) {
        return tabSearchParam as TabOption;
      }
    }
    return TabOption.Supply;
  }, [searchParams]);

  // MARK: custom hooks
  const { lendingPairs, refetch: refetchLendingPairs } = useLendingPairs();

  // NOTE: Instead of `useAvailablePools()`, we're able to compute `availablePools` from `lendingPairs`.
  // This saves a lot of data.
  const availablePools = useMemo(() => {
    const poolInfoMap = new Map<string, UniswapPoolInfo>();
    lendingPairs.forEach((pair) =>
      poolInfoMap.set(pair.uniswapPool.toLowerCase(), {
        token0: pair.token0,
        token1: pair.token1,
        fee: GetNumericFeeTier(pair.uniswapFeeTier),
      })
    );
    return poolInfoMap;
  }, [lendingPairs]);

  const doesGuardianSenseManipulation = useMemo(() => {
    return lendingPairs.some((pair) => pair.oracleData.manipulationMetric > pair.manipulationThreshold);
  }, [lendingPairs]);

  // MARK: wagmi hooks
  const { address: userAddress } = useAccount();
  const client = useClient<Config>({ chainId: activeChain.id });
  const provider = useEthersProvider(client);
  const { data: blockNumber, refetch } = useBlockNumber({
    chainId: activeChain.id,
  });

  const uniqueTokens = useMemo(() => {
    const tokenSet = new Set<Token>();
    lendingPairs.forEach((pair) => {
      tokenSet.add(pair.token0);
      tokenSet.add(pair.token1);
    });
    return Array.from(tokenSet.values());
  }, [lendingPairs]);

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

  // MARK: Computing token colors
  useEffect(() => {
    (async () => {
      // Compute colors for each token logo (local, but still async)
      const colorPromises = uniqueTokens.map((token) => getProminentColor(token.logoURI || ''));
      const colors = await Promise.all(colorPromises);

      // Convert response to the desired Map format
      const addressToColorMap: Map<Address, string> = new Map();
      uniqueTokens.forEach((token, index) => addressToColorMap.set(token.address, colors[index]));
      setTokenColors(addressToColorMap);
    })();
  }, [uniqueTokens, setTokenColors]);

  // MARK: Fetching token prices
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Determine set of unique token symbols (tickers)
      const symbolSet = new Set<string>();
      lendingPairs.forEach((pair) => {
        symbolSet.add(pair.token0.symbol);
        symbolSet.add(pair.token1.symbol);
      });
      const uniqueSymbols = Array.from(symbolSet.values());

      // Return early if there's nothing new to fetch
      if (
        uniqueSymbols.length === 0 ||
        uniqueSymbols.every((symbol) => {
          return tokenQuotes.has(symbol.toLowerCase()) || (symbol === 'USDC.e' && tokenQuotes.has('USDC'));
        })
      ) {
        return;
      }

      // Query API for price data, returning early if request fails
      let quoteDataResponse: AxiosResponse<PriceRelayLatestResponse>;
      try {
        quoteDataResponse = await axios.get(
          `${API_PRICE_RELAY_LATEST_URL}?symbols=${uniqueSymbols.join(',').toUpperCase()}`
        );
      } catch {
        return;
      }
      const prResponse: PriceRelayLatestResponse = quoteDataResponse.data;
      if (!prResponse) return;

      // Convert response to the desired Map format
      const symbolToPriceMap = new Map<TokenSymbol, Quote>();
      Object.entries(prResponse).forEach(([k, v]) => {
        symbolToPriceMap.set(k.toLowerCase(), v.price);
        symbolToPriceMap.set(k, v.price);
      });

      if (mounted) setTokenQuotes(symbolToPriceMap);
    })();

    return () => {
      mounted = false;
    };
  }, [lendingPairs, tokenQuotes, setTokenQuotes]);

  // MARK: Fetching token balances
  useEffect(() => {
    (async () => {
      if (!userAddress || !provider) return;
      // TODO: I've updated this usage of `getLendingPairBalances` to use the `balancesMap` rather than the old array
      // return value. Other usages should be updated similarly.
      const { balancesMap: result } = await getLendingPairBalances(lendingPairs, userAddress, provider, activeChain.id);
      setBalancesMap(result);
    })();
  }, [activeChain.id, lendingPairs, provider, setBalancesMap, userAddress]);

  // MARK: Fetch margin accounts
  useEffect(() => {
    (async () => {
      if (userAddress === undefined || availablePools.size === 0 || !provider) return;

      const chainId = (await provider.getNetwork()).chainId;
      const fuse2BorrowerNfts = await fetchListOfFuse2BorrowNfts(chainId, provider, userAddress);
      const borrowerDatas = (
        await fetchBorrowerDatas(
          chainId,
          provider,
          fuse2BorrowerNfts.map((b) => b.borrowerAddress),
          availablePools
        )
      ).map((borrowerData) => {
        return {
          ...borrowerData,
          index: fuse2BorrowerNfts.find((b) => b.borrowerAddress === borrowerData.address)?.index || 0,
          tokenId: fuse2BorrowerNfts.find((b) => b.borrowerAddress === borrowerData.address)?.tokenId || 0,
        } as BorrowerNftBorrower;
      });

      setBorrowers(borrowerDatas);
    })();
  }, [userAddress, availablePools, provider, blockNumber, setBorrowers]);

  const supplyRows = useMemo(() => {
    const rows: SupplyTableRow[] = [];
    const ethBalance = balancesMap.get(ZERO_ADDRESS);
    lendingPairs.forEach((pair) => {
      const isToken0Weth = pair.token0.name === 'Wrapped Ether';
      const isToken1Weth = pair.token1.name === 'Wrapped Ether';

      const token0Price = tokenQuotes.get(pair.token0.symbol) || 0;
      const token1Price = tokenQuotes.get(pair.token1.symbol) || 0;
      const token0Balance =
        (balancesMap.get(pair.token0.address)?.value || 0) + ((isToken0Weth && ethBalance?.value) || 0);
      const token1Balance =
        (balancesMap.get(pair.token1.address)?.value || 0) + ((isToken1Weth && ethBalance?.value) || 0);
      const kitty0Balance = balancesMap.get(pair.kitty0.address)?.value || 0;
      const kitty1Balance = balancesMap.get(pair.kitty1.address)?.value || 0;

      const oracleHasBeenUpdatedInPastWeek = pair.lastWrite.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;

      if (kitty0Balance > 0 || oracleHasBeenUpdatedInPastWeek) {
        rows.push({
          asset: pair.token0,
          kitty: pair.kitty0,
          apy: pair.kitty0Info.lendAPY * 100,
          rewardsRate: pair.rewardsRate0,
          collateralAssets: [pair.token1],
          totalSupply: pair.kitty0Info.totalAssets.toNumber(),
          suppliedBalance: kitty0Balance,
          suppliableBalance: token0Balance,
          isOptimized: true,
          ...(token0Price > 0
            ? {
                totalSupplyUsd: pair.kitty0Info.totalAssets.toNumber() * token0Price,
                suppliedBalanceUsd: kitty0Balance * token0Price,
                suppliableBalanceUsd: token0Balance * token0Price,
              }
            : {}),
        });
      }
      if (kitty1Balance > 0 || oracleHasBeenUpdatedInPastWeek) {
        rows.push({
          asset: pair.token1,
          kitty: pair.kitty1,
          apy: pair.kitty1Info.lendAPY * 100,
          rewardsRate: pair.rewardsRate1,
          collateralAssets: [pair.token0],
          totalSupply: pair.kitty1Info.totalAssets.toNumber(),
          suppliedBalance: kitty1Balance,
          suppliableBalance: token1Balance,
          isOptimized: true,
          ...(token1Price > 0
            ? {
                totalSupplyUsd: pair.kitty1Info.totalAssets.toNumber() * token1Price,
                suppliedBalanceUsd: kitty1Balance * token1Price,
                suppliableBalanceUsd: token1Balance * token1Price,
              }
            : {}),
        });
      }
    });
    return rows;
  }, [balancesMap, lendingPairs, tokenQuotes]);

  let tabContent: JSX.Element;

  switch (selectedTab) {
    default:
    case TabOption.Supply:
      tabContent = <SupplyTable rows={supplyRows} setPendingTxn={setPendingTxn} />;
      break;
    case TabOption.Borrow:
      tabContent = (
        <BorrowingWidget
          chain={activeChain}
          provider={provider}
          userAddress={userAddress}
          borrowers={borrowers}
          lendingPairs={lendingPairs}
          uniqueTokens={uniqueTokens}
          tokenBalances={balancesMap}
          tokenQuotes={tokenQuotes}
          tokenColors={tokenColors}
          setPendingTxn={setPendingTxn}
        />
      );
      break;
    case TabOption.Monitor:
      tabContent = (
        <InfoTab
          chainId={activeChain.id}
          provider={provider}
          blockNumber={blockNumber}
          lendingPairs={lendingPairs}
          tokenColors={tokenColors}
          setPendingTxn={setPendingTxn}
        />
      );
      break;
    case TabOption.Liquidate:
      tabContent = (
        <LiquidateTab
          chainId={activeChain.id}
          provider={provider}
          lendingPairs={lendingPairs}
          tokenQuotes={tokenQuotes}
          setPendingTxn={setPendingTxn}
        />
      );
      break;
  }

  const totalSupplied = useMemo(() => {
    const totalAssets = supplyRows.reduce((acc, row) => acc + (row.totalSupplyUsd || 0), 0);
    return totalAssets;
  }, [supplyRows]);

  const totalBorrowed = useMemo(() => {
    return lendingPairs.reduce((acc, pair) => {
      const token0Price = tokenQuotes.get(pair.token0.symbol) || 0;
      const token1Price = tokenQuotes.get(pair.token1.symbol) || 0;
      const token0BorrowedUsd = pair.kitty0Info.totalBorrows.toNumber() * token0Price;
      const token1BorrowedUsd = pair.kitty1Info.totalBorrows.toNumber() * token1Price;
      return acc + token0BorrowedUsd + token1BorrowedUsd;
    }, 0);
  }, [lendingPairs, tokenQuotes]);

  const totalAvailable = useMemo(() => {
    return totalSupplied - totalBorrowed;
  }, [totalSupplied, totalBorrowed]);

  const activeChainLogo = getChainLogo(activeChain.id, 32);

  return (
    <AppPage>
      <div className='flex flex-col gap-2 max-w-screen-xl m-auto'>
        <div className='flex flex-row items-center gap-4 mb-4'>
          {activeChainLogo}
          <Text size='XXL'>{activeChain.name} Markets</Text>
        </div>
        <div className='flex flex-row gap-8 ml-1 mb-2'>
          <div className='flex flex-col'>
            <Text size='M' weight='bold' color={SECONDARY_COLOR}>
              Total Supplied
            </Text>
            <Display size='S' weight='semibold'>
              {formatUSDAuto(totalSupplied)}
            </Display>
          </div>
          <div className='flex flex-col'>
            <Text size='M' weight='bold' color={SECONDARY_COLOR}>
              Total Available
            </Text>
            <Display size='S' weight='semibold'>
              {formatUSDAuto(totalAvailable)}
            </Display>
          </div>
          <div className='flex flex-col'>
            <Text size='M' weight='bold' color={SECONDARY_COLOR}>
              Total Borrowed
            </Text>
            <Display size='S' weight='semibold'>
              {formatUSDAuto(totalBorrowed)}
            </Display>
          </div>
        </div>
        <div>
          <div className='flex flex-row' role='tablist'>
            <HeaderSegmentedControlOption
              isActive={selectedTab === TabOption.Supply}
              onClick={() => setSearchParams({ [SELECTED_TAB_KEY]: TabOption.Supply })}
              role='tab'
              aria-selected={selectedTab === TabOption.Supply}
            >
              Supply
            </HeaderSegmentedControlOption>
            <HeaderSegmentedControlOption
              isActive={selectedTab === TabOption.Borrow}
              onClick={() => setSearchParams({ [SELECTED_TAB_KEY]: TabOption.Borrow })}
              role='tab'
              aria-selected={selectedTab === TabOption.Borrow}
            >
              Borrow
            </HeaderSegmentedControlOption>
            <HeaderSegmentedControlOption
              isActive={selectedTab === TabOption.Monitor}
              onClick={() => setSearchParams({ [SELECTED_TAB_KEY]: TabOption.Monitor })}
              role='tab'
              aria-selected={selectedTab === TabOption.Monitor}
            >
              Monitor{doesGuardianSenseManipulation ? ' 🚨' : ''}
            </HeaderSegmentedControlOption>
            <HeaderSegmentedControlOption
              isActive={selectedTab === TabOption.Liquidate}
              onClick={() => setSearchParams({ [SELECTED_TAB_KEY]: TabOption.Liquidate })}
              role='tab'
              aria-selected={selectedTab === TabOption.Liquidate}
            >
              Liquidate
            </HeaderSegmentedControlOption>
          </div>
          <HeaderDividingLine />
        </div>
        {tabContent}
      </div>
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
            refetchLendingPairs?.();
            refetch();
          }, 100);
        }}
        status={pendingTxnModalStatus}
      />
    </AppPage>
  );
}
