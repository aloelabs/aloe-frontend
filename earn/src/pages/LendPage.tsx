import React, { useContext, useEffect, useMemo, useState } from 'react';

import axios, { AxiosResponse } from 'axios';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGreyButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { Divider } from 'shared/lib/components/common/Divider';
import { MultiDropdownButton, MultiDropdownOption } from 'shared/lib/components/common/Dropdown';
import { SquareInputWithIcon } from 'shared/lib/components/common/Input';
import Pagination, { ItemsPerPage } from 'shared/lib/components/common/Pagination';
import { Text } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { getTokenBySymbol } from 'shared/lib/data/TokenData';
import { formatUSD, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import tw from 'twin.macro';
import { useAccount, useEnsName, useProvider, chain as wagmiChain } from 'wagmi';

import { ChainContext } from '../App';
import { ReactComponent as FilterIcon } from '../assets/svg/filter.svg';
import { ReactComponent as SearchIcon } from '../assets/svg/search.svg';
import Tooltip from '../components/common/Tooltip';
import BalanceSlider from '../components/lend/BalanceSlider';
import LendPairCard from '../components/lend/LendPairCard';
import { LendCardPlaceholder } from '../components/lend/LendPairCardPlaceholder';
import LendPieChartWidget from '../components/lend/LendPieChartWidget';
import { RESPONSIVE_BREAKPOINT_XS } from '../data/constants/Breakpoints';
import { API_PRICE_RELAY_LATEST_URL } from '../data/constants/Values';
import {
  filterLendingPairsByTokens,
  getAvailableLendingPairs,
  getLendingPairBalances,
  LendingPair,
  LendingPairBalances,
  sortLendingPairsByAPY,
} from '../data/LendingPair';
import { PriceRelayLatestResponse } from '../data/PriceRelayResponse';

const MIN_PAGE_NUMBER = 1;
const LEND_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const LendHeaderContainer = styled.div`
  display: grid;
  grid-template-columns: 3fr 2fr;
  height: 300px;
`;

const LendHeader = styled.div`
  ${tw`flex flex-col justify-between`}
`;

const LowerLendHeader = styled.div`
  display: flex;
  align-items: center;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    flex-direction: column-reverse;
    align-items: flex-start;
  } ;
`;

const LendCards = styled.div`
  ${tw`flex flex-col`}
  row-gap: 24px;
  margin-top: 24px;
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

export default function LendPage() {
  const { activeChain } = useContext(ChainContext);
  // MARK: component state
  const [tokenQuotes, setTokenQuotes] = useState<TokenQuote[]>([]);
  const [lendingPairs, setLendingPairs] = useState<LendingPair[]>([]);
  const [lendingPairBalances, setLendingPairBalances] = useState<LendingPairBalances[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterOptions, setFilterOptions] = useState<MultiDropdownOption<Token>[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<MultiDropdownOption<Token>[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(MIN_PAGE_NUMBER);
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(10);

  // MARK: wagmi hooks
  const account = useAccount();
  const provider = useProvider({ chainId: activeChain?.id });
  const address = account.address;
  const { data: ensName } = useEnsName({
    address: address,
    chainId: wagmiChain.mainnet.id,
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
  }, [provider, address, activeChain]);

  useEffect(() => {
    let uniqueTokens = new Set<Token>();
    lendingPairs.forEach((pair) => {
      uniqueTokens.add(pair.token0);
      uniqueTokens.add(pair.token1);
    });
    const options: MultiDropdownOption<Token>[] = Array.from(uniqueTokens).map((token) => {
      return {
        value: token,
        label: token.symbol,
        icon: token.logoURI,
      };
    });
    setFilterOptions(options);
    setSelectedOptions(options);
  }, [lendingPairs]);

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
  }, [provider, address, lendingPairs]);

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

  const kittyBalances: TokenBalance[] = useMemo(() => {
    return combinedBalances.filter((balance) => balance.isKitty);
  }, [combinedBalances]);

  const tokenBalances: TokenBalance[] = useMemo(() => {
    return Array.from(new Set(combinedBalances.filter((balance) => !balance.isKitty)).values());
  }, [combinedBalances]);

  // Calculate total USD value of all kitty balances
  const totalKittyBalanceUSD = useMemo(() => {
    return kittyBalances.reduce((acc, tokenBalance) => {
      return acc + tokenBalance.balanceUSD;
    }, 0);
  }, [kittyBalances]);

  // Calculate total USD value of all token balances
  const totalTokenBalanceUSD = useMemo(() => {
    return tokenBalances.reduce((acc, tokenBalance) => {
      return acc + tokenBalance.balanceUSD;
    }, 0);
  }, [tokenBalances]);

  // Calculate the weighted average APY of all kitties
  const apyWeightedAverage = useMemo(() => {
    if (kittyBalances.length === 0 || totalKittyBalanceUSD === 0) {
      return 0;
    }
    return (
      kittyBalances.reduce((acc, tokenAPY) => {
        return acc + tokenAPY.apy * tokenAPY.balanceUSD;
      }, 0) / totalKittyBalanceUSD
    );
  }, [kittyBalances, totalKittyBalanceUSD]);

  const filteredLendingPairs = useMemo(() => {
    return filterLendingPairsByTokens(
      lendingPairs,
      selectedOptions.map((o) => o.value)
    );
  }, [lendingPairs, selectedOptions]);

  const sortedLendingPairs = useMemo(() => {
    return sortLendingPairsByAPY(filteredLendingPairs);
  }, [filteredLendingPairs]);

  const filteredAndSortedPages: LendingPair[][] = useMemo(() => {
    const pages: LendingPair[][] = [];
    let page: LendingPair[] = [];
    sortedLendingPairs.forEach((pair, i) => {
      if (i % itemsPerPage === 0 && i !== 0) {
        pages.push(page);
        page = [];
      }
      page.push(pair);
    });
    pages.push(page);
    return pages;
  }, [sortedLendingPairs, itemsPerPage]);

  return (
    <AppPage>
      <div className='flex flex-col gap-6 max-w-screen-2xl m-auto'>
        <LendHeaderContainer>
          <LendHeader>
            <Text size='XXL' weight='bold'>
              <p>{ensName ? `Hi, ${ensName}.` : 'Hi!'}</p>
              <p>Your {formatUSD(totalKittyBalanceUSD)} investment</p>
              <p>is growing at {roundPercentage(apyWeightedAverage)}% APY.</p>
              <p></p>
            </Text>
            <LowerLendHeader>
              <MultiDropdownButton
                options={filterOptions}
                activeOptions={selectedOptions}
                handleChange={(updatedOptions: MultiDropdownOption<Token>[]) => {
                  setCurrentPage(MIN_PAGE_NUMBER);
                  setSelectedOptions(updatedOptions);
                }}
                DropdownButton={(props: { onClick: () => void }) => {
                  return (
                    <FilledGreyButtonWithIcon
                      onClick={props.onClick}
                      Icon={<FilterIcon />}
                      size='M'
                      position='leading'
                      svgColorType='stroke'
                    >
                      Filter
                    </FilledGreyButtonWithIcon>
                  );
                }}
                SearchInput={(props: { searchTerm: string; onSearch: (searchTerm: string) => void }) => {
                  return (
                    <SquareInputWithIcon
                      placeholder='Search'
                      value={props.searchTerm}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        props.onSearch(e.target.value);
                      }}
                      Icon={<SearchIcon />}
                      size='M'
                      svgColorType='stroke'
                    />
                  );
                }}
                flipDirection={true}
                maxHeight={275}
              />
              <BalanceSlider tokenBalances={combinedBalances} />
            </LowerLendHeader>
          </LendHeader>
          <LendPieChartWidget
            tokenBalances={[...kittyBalances, ...tokenBalances]}
            totalBalanceUSD={totalKittyBalanceUSD + totalTokenBalanceUSD}
          />
        </LendHeaderContainer>
        <Divider />
        <div>
          <div className='flex items-center gap-2'>
            <Text size='L' weight='bold' color={LEND_TITLE_TEXT_COLOR}>
              Lending Pairs
            </Text>
            <Tooltip
              buttonSize='M'
              buttonText=''
              content={`With lending pairs, you can pick which assets borrowers can post as collateral.${' '}
              For example, when you deposit to the WETH/USDC lending pair,${' '}
              borrowers can only use your funds if they post WETH or USDC as collateral.${' '}
              Never deposit to a pair that includes unknown/untrustworthy token(s).`}
              position='top-center'
              filled={true}
            />
          </div>
          <LendCards>
            {filteredAndSortedPages[currentPage - 1].map((lendPair, i) => (
              <LendPairCard
                key={`${lendPair.token0.address}${lendPair.token1.address}${lendPair.uniswapFeeTier}`}
                pair={lendPair}
                hasDeposited0={(lendingPairBalances?.[i]?.kitty0Balance || 0) > 0}
                hasDeposited1={(lendingPairBalances?.[i]?.kitty1Balance || 0) > 0}
              />
            ))}
            {isLoading && (
              <>
                <LendCardPlaceholder />
                <LendCardPlaceholder />
                <LendCardPlaceholder />
              </>
            )}
          </LendCards>
          {filteredLendingPairs.length > 0 && (
            <div className='mt-[42px] mb-[34px]'>
              <Pagination
                totalItems={filteredLendingPairs.length}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                loading={isLoading}
                onPageChange={(page: number) => {
                  setCurrentPage(page);
                }}
                onItemsPerPageChange={(itemsPerPage: ItemsPerPage) => {
                  setItemsPerPage(itemsPerPage);
                }}
              />
            </div>
          )}
          {!isLoading && filteredLendingPairs.length === 0 && (
            <div className='flex flex-col items-center gap-2'>
              <Text size='L' weight='bold' color={LEND_TITLE_TEXT_COLOR}>
                No lending pairs found
              </Text>
              <Text size='M' color={LEND_TITLE_TEXT_COLOR}>
                Try adjusting your filters
              </Text>
            </div>
          )}
        </div>
      </div>
    </AppPage>
  );
}
