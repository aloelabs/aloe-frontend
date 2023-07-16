import React, { useContext, useEffect, useMemo, useState } from 'react';

import axios, { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { getToken, getTokenBySymbol } from 'shared/lib/data/TokenData';
import { roundPercentage } from 'shared/lib/util/Numbers';
import { Address, useAccount, useContract, useProvider } from 'wagmi';

import { ChainContext } from '../App';
import KittyLensAbi from '../assets/abis/KittyLens.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import BorrowTable, { BorrowTableRow } from '../components/lend/BorrowTable';
import CollateralTable, { CollateralTableRow } from '../components/lend/CollateralTable';
import SupplyTable, { SupplyTableRow } from '../components/lend/SupplyTable';
import {
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_LENDER_LENS_ADDRESS,
  UNISWAP_POOL_DENYLIST,
} from '../data/constants/Addresses';
import { TOPIC0_CREATE_MARKET_EVENT } from '../data/constants/Signatures';
import { API_PRICE_RELAY_LATEST_URL } from '../data/constants/Values';
import {
  getAvailableLendingPairs,
  getLendingPairBalances,
  LendingPair,
  LendingPairBalances,
} from '../data/LendingPair';
import { MarginAccount, UniswapPoolInfo, fetchMarginAccounts } from '../data/MarginAccount';
import { MarketInfo, fetchMarketInfoFor } from '../data/MarketInfo';
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
  const [tokenQuotes, setTokenQuotes] = useState<TokenQuote[]>([]);
  const [lendingPairs, setLendingPairs] = useState<LendingPair[]>([]);
  const [lendingPairBalances, setLendingPairBalances] = useState<LendingPairBalances[]>([]);
  const [availablePools, setAvailablePools] = useState<Map<string, UniswapPoolInfo>>(new Map());
  const [marginAccounts, setMarginAccounts] = useState<MarginAccount[]>([]);
  const [marketInfos, setMarketInfos] = useState<MarketInfo[]>([]);

  // MARK: wagmi hooks
  const account = useAccount();
  const provider = useProvider({ chainId: activeChain?.id });
  const userAddress = account.address;

  const borrowerLensContract = useContract({
    abi: MarginAccountLensABI,
    address: ALOE_II_BORROWER_LENS_ADDRESS,
    signerOrProvider: provider,
  });

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
  }, [activeChain, tokenQuotes, tokenQuotes.length, uniqueSymbols]);

  // MARK: Fetch lending pairs
  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const results = await getAvailableLendingPairs(activeChain, provider);
      if (mounted) {
        setLendingPairs(results);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [provider, userAddress, activeChain]);

  // MARK: Fetch lending pair balances
  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (!userAddress) return;
      const results = await Promise.all(lendingPairs.map((p) => getLendingPairBalances(p, userAddress, provider)));
      if (mounted) {
        setLendingPairBalances(results);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [provider, userAddress, lendingPairs]);

  // MARK: Fetch available pools
  useEffect(() => {
    let mounted = true;
    async function fetchAvailablePools() {
      let logs: ethers.providers.Log[] = [];
      try {
        logs = await provider.getLogs({
          fromBlock: 0,
          toBlock: 'latest',
          address: ALOE_II_FACTORY_ADDRESS,
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
          const poolContract = new ethers.Contract(addr, UniswapV3PoolABI, provider);
          return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee()]);
        })
      );

      const poolInfoMap = new Map<string, UniswapPoolInfo>();
      poolAddresses.forEach((addr, i) => {
        const token0 = getToken(activeChain.id, poolInfoTuples[i][0] as Address);
        const token1 = getToken(activeChain.id, poolInfoTuples[i][1] as Address);
        const fee = poolInfoTuples[i][2] as number;
        if (token0 && token1) poolInfoMap.set(addr.toLowerCase(), { token0, token1, fee });
      });

      if (mounted) setAvailablePools(poolInfoMap);
    }

    fetchAvailablePools();
    return () => {
      mounted = false;
    };
  }, [activeChain, provider]);

  // MARK: Fetch margin accounts
  useEffect(() => {
    let mounted = true;
    async function fetch() {
      if (borrowerLensContract == null || userAddress === undefined || availablePools.size === 0) return;
      const marginAccounts = await fetchMarginAccounts(activeChain, provider, userAddress, availablePools);
      if (mounted) {
        setMarginAccounts(marginAccounts);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [userAddress, activeChain, borrowerLensContract, provider, availablePools]);

  // MARK: Fetch market info
  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const lenderLensContract = new ethers.Contract(ALOE_II_LENDER_LENS_ADDRESS, KittyLensAbi, provider);
      const results = await Promise.all(
        marginAccounts.map((account) => {
          return fetchMarketInfoFor(
            lenderLensContract,
            account.lender0,
            account.lender1,
            account.token0.decimals,
            account.token1.decimals
          );
        })
      );
      if (mounted) {
        setMarketInfos(results);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [marginAccounts, provider]);

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
      const token0Balance = tokenBalances.find((balance) => balance.token.address === pair.token0.address);
      const token1Balance = tokenBalances.find((balance) => balance.token.address === pair.token1.address);
      rows.push({
        asset: pair.token0,
        apy: pair.kitty0Info.apy,
        collateralAssets: [pair.token1],
        supplyBalance: token0Balance?.balance || 0,
        supplyBalanceUsd: token0Balance?.balanceUSD || 0,
        isOptimized: true,
      });
      rows.push({
        asset: pair.token1,
        apy: pair.kitty1Info.apy,
        collateralAssets: [pair.token0],
        supplyBalance: token1Balance?.balance || 0,
        supplyBalanceUsd: token1Balance?.balanceUSD || 0,
        isOptimized: true,
      });
    });
    return rows;
  }, [lendingPairs, tokenBalances]);

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

  const borrowRows = useMemo(() => {
    const rows: BorrowTableRow[] = [];
    marginAccounts.forEach((marginAccount) => {
      const token0Price = tokenQuotes.find((quote) => quote.token.address === marginAccount.token0.address)?.price || 0;
      const token1Price = tokenQuotes.find((quote) => quote.token.address === marginAccount.token1.address)?.price || 0;
      const marketInfo = marketInfos.find(
        (info) => info.lender0 === marginAccount.lender0 && info.lender1 === marginAccount.lender1
      );
      const borrowerAPR0 = marketInfo?.borrowerAPR0 || 0;
      const borrowerAPR1 = marketInfo?.borrowerAPR1 || 0;
      const health = Object.values(marginAccount.assets).every((value) => value === 0) ? -1 : marginAccount.health;
      rows.push({
        asset: marginAccount.token0,
        balance: marginAccount.liabilities.amount0,
        balanceUsd: marginAccount.liabilities.amount0 * token0Price,
        apr: roundPercentage(borrowerAPR0 * 100, 2),
        health: health,
        source: marginAccount.token0.symbol + '/' + marginAccount.token1.symbol,
      });
      rows.push({
        asset: marginAccount.token1,
        balance: marginAccount.liabilities.amount1,
        balanceUsd: marginAccount.liabilities.amount1 * token1Price,
        apr: roundPercentage(borrowerAPR1 * 100, 2),
        health: health,
        source: marginAccount.token0.symbol + '/' + marginAccount.token1.symbol,
      });
    });
    return rows;
  }, [marginAccounts, marketInfos, tokenQuotes]);

  return (
    <AppPage>
      <div className='flex flex-col gap-6 max-w-screen-2xl m-auto'>
        <Text size='XL'>Supply</Text>
        <SupplyTable rows={supplyRows} />
        <div className='flex gap-6'>
          <div className='flex flex-col gap-6 w-1/3'>
            <Text size='XL'>Collateral</Text>
            <CollateralTable rows={collateralRows} />
          </div>
          <div className='flex flex-col gap-6 w-2/3'>
            <Text size='XL'>Borrow</Text>
            <BorrowTable rows={borrowRows} />
          </div>
        </div>
      </div>
    </AppPage>
  );
}
