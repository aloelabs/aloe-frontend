import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import axios, { AxiosResponse } from 'axios';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { GREY_400, GREY_600 } from 'shared/lib/data/constants/Colors';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import ShoppingCartIcon from 'shared/lib/assets/svg/ShoppingCart';
import { Token } from 'shared/lib/data/Token';
import { getTokenBySymbol } from 'shared/lib/data/TokenData';
import styled from 'styled-components';
import { useAccount, useBlockNumber, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import PendingTxnModal, { PendingTxnModalStatus } from '../components/common/PendingTxnModal';
import BorrowingWidget, { BorrowEntry, CollateralEntry } from '../components/lend/BorrowingWidget';
import SupplyTable, { SupplyTableRow } from '../components/lend/SupplyTable';
import { BorrowerNftBorrower, fetchListOfFuse2BorrowNfts } from '../data/BorrowerNft';
import { API_PRICE_RELAY_LATEST_URL } from '../data/constants/Values';
import useAvailablePools from '../data/hooks/UseAvailablePools';
import {
  filterLendingPairsByTokens,
  getAvailableLendingPairs,
  getLendingPairBalances,
  LendingPair,
  LendingPairBalances,
} from '../data/LendingPair';
import { fetchBorrowerDatas } from '../data/MarginAccount';
import { PriceRelayLatestResponse } from '../data/PriceRelayResponse';
import { getProminentColor } from '../util/Colors';
import { FilledGreyButton, FilledGreyButtonWithIcon } from 'shared/lib/components/common/Buttons';
import MulticallOperation from '../data/operations/MulticallOperation';
import OperationsModal from '../components/lend/modal/OperationsModal';

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
  const [borrowers, setBorrowers] = useChainDependentState<BorrowerNftBorrower[] | null>(null, activeChain.id);
  const [tokenColors, setTokenColors] = useChainDependentState<Map<string, string>>(new Map(), activeChain.id);
  const [pendingTxn, setPendingTxn] = useState<SendTransactionResult | null>(null);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useState(false);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);
  const [selectedHeaderOption, setSelectedHeaderOption] = useState<HeaderOptions>(HeaderOptions.Supply);
  const [chainOperations, setChainedOperations] = useState<MulticallOperation[]>([]);
  const [isOperationsModalOpen, setIsOperationsModalOpen] = useState(false);

  const addChainedOperation = (operation: MulticallOperation) => {
    setChainedOperations((prev) => [...prev, operation]);
  };

  const { data: blockNumber, refetch } = useBlockNumber({
    chainId: activeChain.id,
  });

  // MARK: wagmi hooks
  const account = useAccount();
  const provider = useProvider({ chainId: activeChain.id });
  const userAddress = account.address;

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
  }, [provider, userAddress, blockNumber, setLendingPairs]);

  useEffect(() => {
    (async () => {
      if (!userAddress) return;
      const results = await getLendingPairBalances(lendingPairs, userAddress, provider, activeChain.id);
      setLendingPairBalances(results);
    })();
  }, [activeChain.id, lendingPairs, provider, setLendingPairBalances, userAddress]);

  // MARK: Fetch margin accounts
  useEffect(() => {
    (async () => {
      if (userAddress === undefined || availablePools.size === 0) return;
      const fuse2BorrowerNfts = await fetchListOfFuse2BorrowNfts(activeChain.id, provider, userAddress);

      const chainId = (await provider.getNetwork()).chainId;
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
  }, [activeChain.id, availablePools, provider, userAddress, blockNumber, setBorrowers]);

  const combinedBalances: TokenBalance[] = useMemo(() => {
    if (tokenQuotes.length === 0) {
      return [];
    }
    let combined = lendingPairs.flatMap((pair, i) => {
      const token0Quote = tokenQuotes.find((quote) => quote.token.equals(pair.token0));
      const token1Quote = tokenQuotes.find((quote) => quote.token.equals(pair.token1));
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
      const existing = distinct.find((d) => d.token.equals(balance.token));
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
      const token0Balance = combinedBalances.find((balance) => balance.token.equals(pair.token0)) || {
        balance: 0,
        balanceUSD: 0,
      };
      const token1Balance = combinedBalances.find((balance) => balance.token.equals(pair.token1)) || {
        balance: 0,
        balanceUSD: 0,
      };
      const kitty0Balance = combinedBalances.find((balance) => balance.token.equals(pair.kitty0)) || {
        balance: 0,
        balanceUSD: 0,
      };
      const kitty1Balance = combinedBalances.find((balance) => balance.token.equals(pair.kitty1)) || {
        balance: 0,
        balanceUSD: 0,
      };
      rows.push({
        asset: pair.token0,
        kitty: pair.kitty0,
        apy: pair.kitty0Info.apy,
        collateralAssets: [pair.token1],
        suppliedBalance: kitty0Balance.balance,
        suppliedBalanceUsd: kitty0Balance.balanceUSD,
        suppliableBalance: token0Balance.balance,
        suppliableBalanceUsd: token0Balance.balanceUSD,
        isOptimized: true,
      });
      rows.push({
        asset: pair.token1,
        kitty: pair.kitty1,
        apy: pair.kitty1Info.apy,
        collateralAssets: [pair.token0],
        suppliedBalance: kitty1Balance.balance,
        suppliedBalanceUsd: kitty1Balance.balanceUSD,
        suppliableBalance: token1Balance.balance,
        suppliableBalanceUsd: token1Balance.balanceUSD,
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
      const kitty0Balance = combinedBalances.find((balance) => balance.token.equals(lendingPair.kitty0));
      const kitty1Balance = combinedBalances.find((balance) => balance.token.equals(lendingPair.kitty1));
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
              disabled={chainOperations.length === 0}
              onClick={() => setIsOperationsModalOpen(true)}
            >
              {chainOperations.length} Operations
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
              collateralEntries={collateralEntries}
              borrowEntries={borrowEntries}
              tokenColors={tokenColors}
              chainedOperations={chainOperations}
              addChainedOperation={addChainedOperation}
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
          chainOperations={chainOperations}
          isOpen={isOperationsModalOpen}
          setIsOpen={setIsOperationsModalOpen}
          setPendingTxn={setPendingTxn}
        />
      )}
    </AppPage>
  );
}
