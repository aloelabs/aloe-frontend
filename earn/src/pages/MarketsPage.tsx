import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import axios, { AxiosResponse } from 'axios';
import ShoppingCartIcon from 'shared/lib/assets/svg/ShoppingCart';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGreyButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import { GREY_400, GREY_600 } from 'shared/lib/data/constants/Colors';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { Token } from 'shared/lib/data/Token';
import styled from 'styled-components';
import { Address, useAccount, useBlockNumber, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import PendingTxnModal, { PendingTxnModalStatus } from '../components/common/PendingTxnModal';
import BorrowingWidget from '../components/lend/BorrowingWidget';
import OperationsModal from '../components/lend/modal/OperationsModal';
import SupplyTable, { SupplyTableRow } from '../components/lend/SupplyTable';
import { BorrowerNftBorrower, fetchListOfFuse2BorrowNfts } from '../data/BorrowerNft';
import { API_PRICE_RELAY_LATEST_URL } from '../data/constants/Values';
import useAvailablePools from '../data/hooks/UseAvailablePools';
import { useLendingPairs } from '../data/hooks/UseLendingPairs';
import { getLendingPairBalances, LendingPairBalancesMap } from '../data/LendingPair';
import { fetchBorrowerDatas } from '../data/MarginAccount';
import MulticallOperation from '../data/operations/MulticallOperator';
import { PriceRelayLatestResponse } from '../data/PriceRelayResponse';
import { getProminentColor } from '../util/Colors';

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

enum HeaderOptions {
  Supply,
  Borrow,
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
  const [pendingTxn, setPendingTxn] = useState<SendTransactionResult | null>(null);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useState(false);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);
  const [selectedHeaderOption, setSelectedHeaderOption] = useState<HeaderOptions>(HeaderOptions.Supply);
  const [multicallOperator] = useState<MulticallOperation>(new MulticallOperation());
  const [, forceUpdate] = useState({});
  const [isOperationsModalOpen, setIsOperationsModalOpen] = useState(false);

  // MARK: custom hooks
  const availablePools = useAvailablePools();
  const { lendingPairs } = useLendingPairs();

  // MARK: wagmi hooks
  const { address: userAddress } = useAccount();
  const provider = useProvider({ chainId: activeChain.id });
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

  useEffect(() => {
    const update = () => forceUpdate({});
    multicallOperator.subscribe(update);
    return () => {
      multicallOperator.unsubscribe(update);
    };
  }, [multicallOperator]);

  useEffect(() => {
    (async () => {
      if (!pendingTxn) return;
      setPendingTxnModalStatus(PendingTxnModalStatus.PENDING);
      setIsPendingTxnModalOpen(true);
      const receipt = await pendingTxn.wait();
      if (receipt.status === 1) {
        setPendingTxnModalStatus(PendingTxnModalStatus.SUCCESS);
      } else {
        setPendingTxnModalStatus(PendingTxnModalStatus.FAILURE);
      }
    })();
  }, [pendingTxn, setIsPendingTxnModalOpen, setPendingTxnModalStatus]);

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
      if (uniqueSymbols.length === 0 || uniqueSymbols.every((symbol) => tokenQuotes.has(symbol))) {
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
      Object.entries(prResponse).forEach(([k, v]) => symbolToPriceMap.set(k, v.price));

      if (mounted) setTokenQuotes(symbolToPriceMap);
    })();

    return () => {
      mounted = false;
    };
  }, [lendingPairs, tokenQuotes, setTokenQuotes]);

  // MARK: Fetching token balances
  useEffect(() => {
    (async () => {
      if (!userAddress) return;
      // TODO: I've updated this usage of `getLendingPairBalances` to use the `balancesMap` rather than the old array
      // return value. Other usages should be updated similarly.
      const { balancesMap: result } = await getLendingPairBalances(lendingPairs, userAddress, provider, activeChain.id);
      setBalancesMap(result);
    })();
  }, [activeChain.id, lendingPairs, provider, setBalancesMap, userAddress]);

  // MARK: Fetch margin accounts
  useEffect(() => {
    (async () => {
      if (userAddress === undefined || availablePools.size === 0) return;

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
    lendingPairs.forEach((pair) => {
      const token0Price = tokenQuotes.get(pair.token0.symbol) || 0;
      const token1Price = tokenQuotes.get(pair.token1.symbol) || 0;
      const token0Balance = balancesMap.get(pair.token0.address)?.value || 0;
      const token1Balance = balancesMap.get(pair.token1.address)?.value || 0;
      const kitty0Balance = balancesMap.get(pair.kitty0.address)?.value || 0;
      const kitty1Balance = balancesMap.get(pair.kitty1.address)?.value || 0;
      rows.push({
        asset: pair.token0,
        kitty: pair.kitty0,
        apy: pair.kitty0Info.lendAPY,
        rewardsRate: pair.rewardsRate0,
        collateralAssets: [pair.token1],
        totalSupply: pair.kitty0Info.inventory,
        totalSupplyUsd: pair.kitty0Info.inventory * token0Price,
        suppliedBalance: kitty0Balance,
        suppliedBalanceUsd: kitty0Balance * token0Price,
        suppliableBalance: token0Balance,
        suppliableBalanceUsd: token0Balance * token0Price,
        isOptimized: true,
      });
      rows.push({
        asset: pair.token1,
        kitty: pair.kitty1,
        apy: pair.kitty1Info.lendAPY,
        rewardsRate: pair.rewardsRate1,
        collateralAssets: [pair.token0],
        totalSupply: pair.kitty1Info.inventory,
        totalSupplyUsd: pair.kitty1Info.inventory * token1Price,
        suppliedBalance: kitty1Balance,
        suppliedBalanceUsd: kitty1Balance * token1Price,
        suppliableBalance: token1Balance,
        suppliableBalanceUsd: token1Balance * token1Price,
        isOptimized: true,
      });
    });
    return rows;
  }, [balancesMap, lendingPairs, tokenQuotes]);

  return (
    <AppPage>
      <div className='flex flex-col gap-4 max-w-screen-xl m-auto'>
        <Text size='XXL' className='mb-4'>
          {activeChain.name} Markets
        </Text>
        <div>
          <div className='flex flex-row justify-between items-center'>
            <div className='flex flex-row' role='tablist'>
              <HeaderSegmentedControlOption
                isActive={selectedHeaderOption === HeaderOptions.Supply}
                onClick={() => setSelectedHeaderOption(HeaderOptions.Supply)}
                role='tab'
                aria-selected={selectedHeaderOption === HeaderOptions.Supply}
              >
                Supply
              </HeaderSegmentedControlOption>
              <HeaderSegmentedControlOption
                isActive={selectedHeaderOption === HeaderOptions.Borrow}
                onClick={() => setSelectedHeaderOption(HeaderOptions.Borrow)}
                role='tab'
                aria-selected={selectedHeaderOption === HeaderOptions.Borrow}
              >
                Borrow
              </HeaderSegmentedControlOption>
            </div>
            <FilledGreyButtonWithIcon
              size='S'
              Icon={<ShoppingCartIcon />}
              position='leading'
              svgColorType='stroke'
              disabled={multicallOperator.getModifyOperations().length === 0}
              onClick={() => setIsOperationsModalOpen(true)}
            >
              {multicallOperator.getModifyOperations().length} Operations
            </FilledGreyButtonWithIcon>
          </div>
          <HeaderDividingLine />
        </div>
        {selectedHeaderOption === HeaderOptions.Supply ? (
          <SupplyTable rows={supplyRows} setPendingTxn={setPendingTxn} />
        ) : (
          <div className='flex flex-col gap-6'>
            <BorrowingWidget
              borrowers={borrowers}
              lendingPairs={lendingPairs}
              uniqueTokens={uniqueTokens}
              tokenBalances={balancesMap}
              tokenQuotes={tokenQuotes}
              tokenColors={tokenColors}
              multicallOperator={multicallOperator}
              setPendingTxn={setPendingTxn}
            />
          </div>
        )}
      </div>
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
          setTimeout(() => refetch(), 100);
        }}
        status={pendingTxnModalStatus}
      />
      {isOperationsModalOpen && (
        <OperationsModal
          multicallOperator={multicallOperator}
          isOpen={isOperationsModalOpen}
          setIsOpen={setIsOperationsModalOpen}
          setPendingTxn={setPendingTxn}
        />
      )}
    </AppPage>
  );
}
