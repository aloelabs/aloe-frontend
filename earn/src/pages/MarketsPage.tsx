import { useEffect, useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { useSearchParams } from 'react-router-dom';
import AppPage from 'shared/lib/components/common/AppPage';
import { Display, Text } from 'shared/lib/components/common/Typography';
import {
  ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS,
  ALOE_II_PERMIT2_MANAGER_ADDRESS,
  ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS,
  getChainLogo,
} from 'shared/lib/data/constants/ChainSpecific';
import { GREY_400, GREY_600 } from 'shared/lib/data/constants/Colors';
import { Token } from 'shared/lib/data/Token';
import { useBorrowerNfts } from 'shared/lib/hooks/UseBorrowerNft';
import useChain from 'shared/lib/hooks/UseChain';
import { useLendingPairsBalances } from 'shared/lib/hooks/UseLendingPairBalances';
import { useLendingPairs } from 'shared/lib/hooks/UseLendingPairs';
import { useLatestPriceRelay } from 'shared/lib/hooks/UsePriceRelay';
import { useTokenColors } from 'shared/lib/hooks/UseTokenColors';
import { formatUSDAuto } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { linea } from 'viem/chains';
import { Config, useAccount, useBlockNumber, useClient, usePublicClient } from 'wagmi';

import PendingTxnModal, { PendingTxnModalStatus } from '../components/common/PendingTxnModal';
import BorrowingWidget from '../components/markets/borrow/BorrowingWidget';
import LiquidateTab from '../components/markets/liquidate/LiquidateTab';
import InfoTab from '../components/markets/monitor/InfoTab';
import SupplyTable, { SupplyTableRow } from '../components/markets/supply/SupplyTable';
import { useDeprecatedMarginAccountShim } from '../data/BorrowerNft';
import { ZERO_ADDRESS } from '../data/constants/Addresses';
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

export default function MarketsPage() {
  const activeChain = useChain();
  // MARK: component state
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

  // MARK: wagmi hooks
  const { address: userAddress } = useAccount();
  const client = useClient<Config>({ chainId: activeChain.id });
  const provider = useEthersProvider(client);

  // MARK: custom hooks
  const { lendingPairs, refetchOracleData, refetchLenderData } = useLendingPairs(activeChain.id);
  const { data: tokenColors } = useTokenColors(lendingPairs);
  const { data: tokenQuotes } = useLatestPriceRelay(lendingPairs);
  const { balances: balancesMap, refetch: refetchBalances } = useLendingPairsBalances(lendingPairs, activeChain.id);

  const borrowerNftFilterParams = useMemo(
    () => ({
      includeUnusedBorrowers: false,
      onlyCheckMostRecentModify: true,
      validManagerSet: new Set([
        ALOE_II_PERMIT2_MANAGER_ADDRESS[activeChain.id],
        ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS[activeChain.id],
        ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS[activeChain.id],
      ]),
    }),
    [activeChain.id]
  );
  const {
    borrowerNftRefs,
    borrowers: rawBorrowers,
    refetchBorrowerNftRefs,
    refetchBorrowers,
  } = useBorrowerNfts(lendingPairs, userAddress, activeChain.id, borrowerNftFilterParams);
  const borrowers = useDeprecatedMarginAccountShim(lendingPairs, borrowerNftRefs, rawBorrowers);

  // Poll for `blockNumber` when app is in the foreground. Not much different than a `useInterval` that stops
  // when in the background
  const { data: blockNumber } = useBlockNumber({
    chainId: activeChain.id,
    cacheTime: 5_000,
    watch: false,
    query: {
      refetchOnMount: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 5_000,
      refetchIntervalInBackground: false,
    },
  });
  // Use the `blockNumber` to trigger refresh of certain data
  useEffect(() => {
    if (activeChain.id === linea.id || !blockNumber) return;
    // NOTE: Due to polling, we don't receive every block, so this bisection isn't perfect. Close enough though.
    if (blockNumber % 2n) {
      refetchOracleData();
    } else if (selectedTab === TabOption.Borrow) {
      refetchBorrowers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockNumber]);

  const doesGuardianSenseManipulation = useMemo(() => {
    return lendingPairs.some((pair) => pair.oracleData.manipulationMetric > pair.manipulationThreshold);
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

  const supplyRows = useMemo(() => {
    const rows: SupplyTableRow[] = [];
    const ethBalance = balancesMap.get(ZERO_ADDRESS);
    lendingPairs.forEach((pair) => {
      const isToken0Weth = pair.token0.name === 'Wrapped Ether';
      const isToken1Weth = pair.token1.name === 'Wrapped Ether';

      const token0Price = tokenQuotes?.get(pair.token0.symbol) || 0;
      const token1Price = tokenQuotes?.get(pair.token1.symbol) || 0;
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
          collateralAssets: [pair.token0, pair.token1],
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
          collateralAssets: [pair.token1, pair.token0],
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
          userAddress={userAddress}
          borrowers={borrowers}
          lendingPairs={lendingPairs}
          tokenBalances={balancesMap}
          tokenQuotes={tokenQuotes!}
          tokenColors={tokenColors!}
          setPendingTxn={setPendingTxn}
        />
      );
      break;
    case TabOption.Monitor:
      tabContent = (
        <InfoTab
          chainId={activeChain.id}
          provider={provider}
          lendingPairs={lendingPairs}
          tokenColors={tokenColors!}
          setPendingTxn={setPendingTxn}
        />
      );
      break;
    case TabOption.Liquidate:
      tabContent = (
        <LiquidateTab
          chainId={activeChain.id}
          lendingPairs={lendingPairs}
          tokenQuotes={tokenQuotes!}
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
      const token0Price = tokenQuotes?.get(pair.token0.symbol) || 0;
      const token1Price = tokenQuotes?.get(pair.token1.symbol) || 0;
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
          setPendingTxn(null);
          setIsPendingTxnModalOpen(false);
          refetchLenderData();
          refetchBalances();
          refetchBorrowerNftRefs().then(() => refetchBorrowers());
        }}
        status={pendingTxnModalStatus}
      />
    </AppPage>
  );
}
