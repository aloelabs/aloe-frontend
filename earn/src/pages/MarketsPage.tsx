import { useContext, useEffect, useMemo } from 'react';

import axios, { AxiosResponse } from 'axios';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { Token } from 'shared/lib/data/Token';
import { getTokenBySymbol } from 'shared/lib/data/TokenData';
import { useAccount, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import CollateralTable, { CollateralTableRow } from '../components/lend/CollateralTable';
import SupplyTable, { SupplyTableRow } from '../components/lend/SupplyTable';
import { API_PRICE_RELAY_LATEST_URL } from '../data/constants/Values';
import {
  getAvailableLendingPairs,
  getLendingPairBalances,
  LendingPair,
  LendingPairBalances,
} from '../data/LendingPair';
import { PriceRelayLatestResponse } from '../data/PriceRelayResponse';

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

export default function MarketsPage() {
  const { activeChain } = useContext(ChainContext);
  // MARK: component state
  const [tokenQuotes, setTokenQuotes] = useChainDependentState<TokenQuote[]>([], activeChain.id);
  const [lendingPairs, setLendingPairs] = useChainDependentState<LendingPair[]>([], activeChain.id);
  const [lendingPairBalances, setLendingPairBalances] = useChainDependentState<LendingPairBalances[]>(
    [],
    activeChain.id
  );

  // MARK: wagmi hooks
  const account = useAccount();
  const provider = useProvider({ chainId: activeChain.id });
  const address = account.address;

  const uniqueSymbols = useMemo(() => {
    const symbols = new Set<string>();
    lendingPairs.forEach((pair) => {
      symbols.add(pair.token0.symbol.toUpperCase());
      symbols.add(pair.token1.symbol.toUpperCase());
    });
    return Array.from(symbols.values()).join(',');
  }, [lendingPairs]);

  useEffect(() => {
    let mounted = true;
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
      if (mounted && tokenQuotes.length === 0) {
        setTokenQuotes(tokenQuoteData);
      }
    }
    if (uniqueSymbols.length > 0 && tokenQuotes.length === 0) {
      fetch();
    }
    return () => {
      mounted = false;
    };
  }, [activeChain, tokenQuotes, uniqueSymbols, setTokenQuotes]);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const chainId = (await provider.getNetwork()).chainId;
      const results = await getAvailableLendingPairs(chainId, provider);
      if (mounted) {
        setLendingPairs(results);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [provider, address, setLendingPairs]);

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
  }, [provider, address, lendingPairs, setLendingPairBalances]);

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
        apy: pair.kitty0Info.apy,
        collateralAssets: [pair.token1],
        supplyBalance: kitty0Balance?.balance || 0,
        supplyBalanceUsd: kitty0Balance?.balanceUSD || 0,
        isOptimized: true,
      });
      rows.push({
        asset: pair.token1,
        apy: pair.kitty1Info.apy,
        collateralAssets: [pair.token0],
        supplyBalance: kitty1Balance?.balance || 0,
        supplyBalanceUsd: kitty1Balance?.balanceUSD || 0,
        isOptimized: true,
      });
    });
    return rows;
  }, [combinedBalances, lendingPairs]);

  const collateralRows = useMemo(() => {
    const rows: CollateralTableRow[] = [];
    tokenBalances.forEach((tokenBalance) => {
      if (tokenBalance.balance !== 0) {
        rows.push({
          asset: tokenBalance.token,
          balance: tokenBalance.balance,
          balanceUsd: tokenBalance.balanceUSD,
        });
      }
    });
    return rows;
  }, [tokenBalances]);

  return (
    <AppPage>
      <div className='flex flex-col gap-6 max-w-screen-2xl m-auto'>
        <Text size='XL'>Supply</Text>
        <SupplyTable rows={supplyRows} />
        <div className='flex flex-col gap-6'>
          <Text size='XL'>Collateral</Text>
          <CollateralTable rows={collateralRows} />
        </div>
      </div>
    </AppPage>
  );
}
