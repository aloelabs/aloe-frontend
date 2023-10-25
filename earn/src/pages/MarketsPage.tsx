import { useContext, useEffect, useMemo } from 'react';

import axios, { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import { borrowerLensAbi } from 'shared/lib/abis/BorrowerLens';
import { uniswapV3PoolAbi } from 'shared/lib/abis/UniswapV3Pool';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BORROWER_LENS_ADDRESS, ALOE_II_FACTORY_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { Token } from 'shared/lib/data/Token';
import { getToken, getTokenBySymbol } from 'shared/lib/data/TokenData';
import { Address, useAccount, useContract, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import BorrowingWidget, { BorrowEntry, CollateralEntry } from '../components/lend/BorrowingWidget';
import CollateralTable, { CollateralTableRow } from '../components/lend/CollateralTable';
import SupplyTable, { SupplyTableRow } from '../components/lend/SupplyTable';
import { UNISWAP_POOL_DENYLIST } from '../data/constants/Addresses';
import { TOPIC0_CREATE_MARKET_EVENT } from '../data/constants/Signatures';
import { API_PRICE_RELAY_LATEST_URL } from '../data/constants/Values';
import {
  getAvailableLendingPairs,
  getLendingPairBalances,
  LendingPair,
  LendingPairBalances,
} from '../data/LendingPair';
import { fetchMarginAccounts, MarginAccount, UniswapPoolInfo } from '../data/MarginAccount';
import { PriceRelayLatestResponse } from '../data/PriceRelayResponse';
import { getProminentColor } from '../util/Colors';

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
  const [availablePools, setAvailablePools] = useChainDependentState(
    new Map<string, UniswapPoolInfo>(),
    activeChain.id
  );
  const [marginAccounts, setMarginAccounts] = useChainDependentState<MarginAccount[] | null>(null, activeChain.id);
  const [tokenColors, setTokenColors] = useChainDependentState<Map<string, string>>(new Map(), activeChain.id);

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

  // MARK: Fetch available pools
  useEffect(() => {
    (async () => {
      // NOTE: Use chainId from provider instead of `activeChain.id` since one may update before the other
      // when rendering. We want to stay consistent to avoid fetching things from the wrong address.
      const chainId = (await provider.getNetwork()).chainId;
      let logs: ethers.providers.Log[] = [];
      try {
        logs = await provider.getLogs({
          fromBlock: 0,
          toBlock: 'latest',
          address: ALOE_II_FACTORY_ADDRESS[chainId],
          topics: [TOPIC0_CREATE_MARKET_EVENT],
        });
      } catch (e) {
        console.error(e);
      }

      const poolAddresses = logs
        .map((e) => `0x${e.topics[1].slice(-40)}`)
        .filter((addr) => {
          return !UNISWAP_POOL_DENYLIST.includes(addr.toLowerCase());
        });
      const poolInfoTuples = await Promise.all(
        poolAddresses.map((addr) => {
          const poolContract = new ethers.Contract(addr, uniswapV3PoolAbi, provider);
          return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee()]);
        })
      );

      const poolInfoMap = new Map<string, UniswapPoolInfo>();
      poolAddresses.forEach((addr, i) => {
        const token0 = getToken(chainId, poolInfoTuples[i][0] as Address);
        const token1 = getToken(chainId, poolInfoTuples[i][1] as Address);
        const fee = poolInfoTuples[i][2] as number;
        if (token0 && token1) poolInfoMap.set(addr.toLowerCase(), { token0, token1, fee });
      });

      setAvailablePools(poolInfoMap);
    })();
  }, [provider, setAvailablePools]);

  const borrowerLensContract = useContract({
    abi: borrowerLensAbi,
    address: ALOE_II_BORROWER_LENS_ADDRESS[activeChain.id],
    signerOrProvider: provider,
  });

  // MARK: Fetch margin accounts
  useEffect(() => {
    (async () => {
      if (borrowerLensContract == null || userAddress === undefined || availablePools.size === 0) return;
      const chainId = (await provider.getNetwork()).chainId;
      const fetchedMarginAccounts = await fetchMarginAccounts(chainId, provider, userAddress, availablePools);
      setMarginAccounts(fetchedMarginAccounts);
    })();
  }, [userAddress, borrowerLensContract, provider, availablePools, setMarginAccounts]);

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

  const collateralEntries = useMemo(() => {
    const entries: CollateralEntry[] = [];
    tokenBalances.forEach((tokenBalance) => {
      if (tokenBalance.balance !== 0) {
        const matchingPairs = lendingPairs.filter((pair) => {
          return (
            pair.token0.address === tokenBalance.token.address || pair.token1.address === tokenBalance.token.address
          );
        });
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
        existing.push(borrowable);
      } else if (borrowable.supply > 0) {
        acc[borrowable.asset.symbol] = [borrowable];
      }
      return acc;
    }, {});
  }, [combinedBalances, lendingPairs]);

  return (
    <AppPage>
      <div className='flex flex-col gap-6 max-w-screen-2xl m-auto'>
        <Text size='XL'>Supply</Text>
        <SupplyTable rows={supplyRows} />
        <div className='flex flex-col gap-6'>
          <BorrowingWidget
            marginAccounts={marginAccounts}
            collateralEntries={collateralEntries}
            borrowEntries={borrowEntries}
            tokenColors={tokenColors}
          />
          <Text size='XL'>Collateral</Text>
          <CollateralTable rows={collateralRows} />
        </div>
      </div>
    </AppPage>
  );
}
