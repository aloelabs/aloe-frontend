import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import axios, { AxiosResponse } from 'axios';
import { useNavigate } from 'react-router-dom';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { GREY_600 } from 'shared/lib/data/constants/Colors';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { Token } from 'shared/lib/data/Token';
import { getTokenBySymbol } from 'shared/lib/data/TokenData';
import styled from 'styled-components';
import { useAccount, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import PendingTxnModal, { PendingTxnModalStatus } from '../components/common/PendingTxnModal';
import BorrowingWidget, { BorrowEntry, CollateralEntry } from '../components/lend/BorrowingWidget';
import SupplyTable, { SupplyTableRow } from '../components/lend/SupplyTable';
import { fetchListOfFuse2BorrowNfts } from '../data/BorrowerNft';
import { API_PRICE_RELAY_LATEST_URL } from '../data/constants/Values';
import useAvailablePools from '../data/hooks/UseAvailablePools';
import {
  filterLendingPairsByTokens,
  getAvailableLendingPairs,
  getLendingPairBalances,
  LendingPair,
  LendingPairBalances,
} from '../data/LendingPair';
import { fetchBorrowerDatas, MarginAccount } from '../data/MarginAccount';
import { PriceRelayLatestResponse } from '../data/PriceRelayResponse';
import { getProminentColor } from '../util/Colors';

const HeaderDividingLine = styled.hr`
  color: ${GREY_600};
  background-color: ${GREY_600};

  height: 1px;
`;

const HeaderSegmentedControlOption = styled(Text).attrs((props: { isActive: boolean }) => props)`
  height: 24px;
  cursor: pointer;
  color: ${(props) => (props.isActive ? 'white' : GREY_600)};

  &:hover {
    color: white;
  }

  position: relative;
  &:after {
    position: absolute;
    content: ${(props) => (props.isActive ? "''" : 'none')};
    background-color: white;

    top: 40px;
    left: 0px;
    width: 100%;
    height: 1px;
  }
`;

export type TokenQuote = {
  token: Token;
  price: number;
};

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

export default function MarketsPage() {
  const { activeChain } = useContext(ChainContext);
  // MARK: component state
  const [tokenQuotes, setTokenQuotes] = useChainDependentState<TokenQuote[]>([], activeChain.id);
  const [lendingPairs, setLendingPairs] = useChainDependentState<LendingPair[]>([], activeChain.id);
  const [lendingPairBalances, setLendingPairBalances] = useChainDependentState<LendingPairBalances[]>(
    [],
    activeChain.id
  );
  const [marginAccounts, setMarginAccounts] = useChainDependentState<MarginAccount[] | null>(null, activeChain.id);
  const [tokenColors, setTokenColors] = useChainDependentState<Map<string, string>>(new Map(), activeChain.id);
  const [pendingTxn, setPendingTxn] = useState<SendTransactionResult | null>(null);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useState(false);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);
  const [selectedHeaderOption, setSelectedHeaderOption] = useState<HeaderOptions>(HeaderOptions.Supply);

  // MARK: wagmi hooks
  const account = useAccount();
  const provider = useProvider({ chainId: activeChain.id });
  const userAddress = account.address;
  const navigate = useNavigate();

  const uniqueTokens = useMemo(() => {
    const tokens = new Set<Token>();
    lendingPairs.forEach((pair) => {
      tokens.add(pair.token0);
      tokens.add(pair.token1);
    });
    return Array.from(tokens.values());
  }, [lendingPairs]);

  const uniqueSymbols = useMemo(() => {
    const symbols = new Set<string>();
    lendingPairs.forEach((pair) => {
      symbols.add(pair.token0.symbol.toUpperCase());
      symbols.add(pair.token1.symbol.toUpperCase());
    });
    return Array.from(symbols.values()).join(',');
  }, [lendingPairs]);

  const availablePools = useAvailablePools();

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
    async function fetch() {
      // fetch token quotes
      let quoteDataResponse: AxiosResponse<PriceRelayLatestResponse>;
      try {
        quoteDataResponse = await axios.get(`${API_PRICE_RELAY_LATEST_URL}?symbols=${uniqueSymbols}`);
      } catch {
        return;
      }
      const prResponse: PriceRelayLatestResponse = quoteDataResponse.data;
      if (!prResponse) {
        return;
      }
      const tokenQuoteData: TokenQuote[] = Object.entries(prResponse).map(([key, value]) => {
        return {
          token: getTokenBySymbol(activeChain.id, key),
          price: value.price,
        };
      });
      if (tokenQuotes.length === 0) {
        setTokenQuotes(tokenQuoteData);
      }
    }
    if (uniqueSymbols.length > 0 && tokenQuotes.length === 0) {
      fetch();
    }
  }, [activeChain, tokenQuotes, uniqueSymbols, setTokenQuotes]);

  useEffect(() => {
    (async () => {
      const chainId = (await provider.getNetwork()).chainId;
      const results = await getAvailableLendingPairs(chainId, provider);
      setLendingPairs(results);
    })();
  }, [provider, userAddress, setLendingPairs]);

  useEffect(() => {
    (async () => {
      if (!userAddress) return;
      const results = await Promise.all(lendingPairs.map((p) => getLendingPairBalances(p, userAddress, provider)));
      setLendingPairBalances(results);
    })();
  }, [provider, userAddress, lendingPairs, setLendingPairBalances]);

  // MARK: Fetch margin accounts
  useEffect(() => {
    (async () => {
      if (userAddress === undefined || availablePools.size === 0) return;
      const fuse2BorrowerNfts = await fetchListOfFuse2BorrowNfts(activeChain.id, provider, userAddress);

      const chainId = (await provider.getNetwork()).chainId;
      const borrowerDatas = await fetchBorrowerDatas(
        chainId,
        provider,
        fuse2BorrowerNfts.map((b) => b.borrowerAddress),
        availablePools
      );
      setMarginAccounts(borrowerDatas);
    })();
  }, [activeChain.id, availablePools, provider, setMarginAccounts, userAddress]);

  const combinedBalances: TokenBalance[] = useMemo(() => {
    if (tokenQuotes.length === 0) {
      return [];
    }
    let combined = lendingPairs.flatMap((pair, i) => {
      const token0Quote = tokenQuotes.find(
        (quote) => quote.token.address === (pair.token0?.address || pair.token0.address)
      );
      const token1Quote = tokenQuotes.find(
        (quote) => quote.token.address === (pair.token1?.address || pair.token1.address)
      );
      const token0Price = token0Quote?.price || 0;
      const token1Price = token1Quote?.price || 0;
      const pairName = `${pair.token0.symbol}-${pair.token1.symbol}`;
      return [
        {
          token: pair.token0,
          balance: lendingPairBalances?.[i]?.token0Balance || 0,
          balanceUSD: (lendingPairBalances?.[i]?.token0Balance || 0) * token0Price,
          apy: 0,
          isKitty: false,
          pairName,
        },
        {
          token: pair.token1,
          balance: lendingPairBalances?.[i]?.token1Balance || 0,
          balanceUSD: (lendingPairBalances?.[i]?.token1Balance || 0) * token1Price,
          apy: 0,
          isKitty: false,
          pairName,
        },
        {
          token: pair.kitty0,
          balance: lendingPairBalances?.[i]?.kitty0Balance || 0,
          balanceUSD: (lendingPairBalances?.[i]?.kitty0Balance || 0) * token0Price,
          apy: pair.kitty0Info.apy,
          isKitty: true,
          pairName,
        },
        {
          token: pair.kitty1,
          balance: lendingPairBalances?.[i]?.kitty1Balance || 0,
          balanceUSD: (lendingPairBalances?.[i]?.kitty1Balance || 0) * token1Price,
          apy: pair.kitty1Info.apy,
          isKitty: true,
          pairName,
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

  const tokenBalances: TokenBalance[] = useMemo(() => {
    return Array.from(new Set(combinedBalances.filter((balance) => !balance.isKitty)).values());
  }, [combinedBalances]);

  const supplyRows = useMemo(() => {
    const rows: SupplyTableRow[] = [];
    lendingPairs.forEach((pair) => {
      const kitty0Balance = combinedBalances.find(
        (balance) => balance.token.address === (pair.kitty0?.address || pair.kitty0.address)
      );
      const kitty1Balance = combinedBalances.find(
        (balance) => balance.token.address === (pair.kitty1?.address || pair.kitty1.address)
      );
      rows.push({
        asset: pair.token0,
        kitty: pair.kitty0,
        apy: pair.kitty0Info.apy,
        collateralAssets: [pair.token1],
        supplyBalance: kitty0Balance?.balance || 0,
        supplyBalanceUsd: kitty0Balance?.balanceUSD || 0,
        isOptimized: true,
      });
      rows.push({
        asset: pair.token1,
        kitty: pair.kitty1,
        apy: pair.kitty1Info.apy,
        collateralAssets: [pair.token0],
        supplyBalance: kitty1Balance?.balance || 0,
        supplyBalanceUsd: kitty1Balance?.balanceUSD || 0,
        isOptimized: true,
      });
    });
    return rows;
  }, [combinedBalances, lendingPairs]);

  const collateralEntries = useMemo(() => {
    const entries: CollateralEntry[] = [];
    tokenBalances.forEach((tokenBalance) => {
      if (tokenBalance.balance !== 0) {
        const matchingPairs = filterLendingPairsByTokens(lendingPairs, [tokenBalance.token]);
        entries.push({
          asset: tokenBalance.token,
          balance: tokenBalance.balance,
          matchingPairs: matchingPairs,
        });
      }
    });
    return entries;
  }, [lendingPairs, tokenBalances]);

  const borrowEntries = useMemo(() => {
    const borrowable = lendingPairs.reduce((acc: BorrowEntry[], lendingPair) => {
      const kitty0Balance = combinedBalances.find(
        (balance) => balance.token.address === (lendingPair.kitty0?.address || lendingPair.kitty0.address)
      );
      const kitty1Balance = combinedBalances.find(
        (balance) => balance.token.address === (lendingPair.kitty1?.address || lendingPair.kitty1.address)
      );
      acc.push({
        asset: lendingPair.token0,
        collateral: lendingPair.token1,
        apy: lendingPair.kitty0Info.apy,
        supply: kitty0Balance?.balance || 0,
      });
      acc.push({
        asset: lendingPair.token1,
        collateral: lendingPair.token0,
        apy: lendingPair.kitty1Info.apy,
        supply: kitty1Balance?.balance || 0,
      });
      return acc;
    }, []);
    return borrowable.reduce((acc: { [key: string]: BorrowEntry[] }, borrowable) => {
      const existing = acc[borrowable.asset.symbol];
      if (existing && borrowable.supply > 0) {
        // If the asset already exists in the accumulator, push the borrowable
        existing.push(borrowable);
      } else if (borrowable.supply > 0) {
        // Otherwise, create a new array with the borrowable
        acc[borrowable.asset.symbol] = [borrowable];
      }
      return acc;
    }, {});
  }, [combinedBalances, lendingPairs]);

  return (
    <AppPage>
      <div className='flex flex-col gap-4 max-w-screen-xl m-auto'>
        <Text size='XXL' className='mb-4'>
          {activeChain.name} Markets
        </Text>
        <div className='flex flex-row gap-8'>
          <HeaderSegmentedControlOption
            size='M'
            isActive={selectedHeaderOption === HeaderOptions.Supply}
            onClick={() => setSelectedHeaderOption(HeaderOptions.Supply)}
          >
            Supply
          </HeaderSegmentedControlOption>
          <HeaderSegmentedControlOption
            size='M'
            isActive={selectedHeaderOption === HeaderOptions.Borrow}
            onClick={() => setSelectedHeaderOption(HeaderOptions.Borrow)}
          >
            Borrow
          </HeaderSegmentedControlOption>
        </div>
        <HeaderDividingLine />
        {selectedHeaderOption === HeaderOptions.Supply ? (
          <SupplyTable rows={supplyRows} setPendingTxn={setPendingTxn} />
        ) : (
          <div className='flex flex-col gap-6'>
            <BorrowingWidget
              marginAccounts={marginAccounts}
              collateralEntries={collateralEntries}
              borrowEntries={borrowEntries}
              tokenColors={tokenColors}
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
          setTimeout(() => {
            navigate(0);
          }, 100);
        }}
        status={pendingTxnModalStatus}
      />
    </AppPage>
  );
}
