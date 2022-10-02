import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGreyButtonWithIcon } from '../components/common/Buttons';
import BalanceSlider, { TokenBalance } from '../components/lend/BalanceSlider';
import { GetTokenData, getTokens, TokenQuote, TokenBalanceUSD } from '../data/TokenData';
import { Text } from 'shared/lib/components/common/Typography';
import { formatUSD, roundPercentage } from '../util/Numbers';
import { ReactComponent as FilterIcon } from '../assets/svg/filter.svg';
import { Divider } from 'shared/lib/components/common/Divider';
import Tooltip from '../components/common/Tooltip';
import LendPairCard from '../components/lend/LendPairCard';
import Pagination, { ItemsPerPage } from '../components/common/Pagination';
import { MultiDropdownButton, MultiDropdownOption } from '../components/common/Dropdown';
import { SquareInputWithIcon } from '../components/common/Input';
import { ReactComponent as SearchIcon } from '../assets/svg/search.svg';
import { chain, useAccount, useEnsName, useProvider } from 'wagmi';
import { getAvailableLendingPairs, LendingPair } from '../data/LendingPair';
import LendPieChartWidget from '../components/lend/LendPieChartWidget';
import axios, { AxiosResponse } from 'axios';
import { PriceRelayResponse } from '../data/PriceRelayResponse';
import { API_PRICE_RELAY_URL } from '../data/constants/Values';
import useEffectOnce from '../data/hooks/UseEffectOnce';
import useMediaQuery from '../data/hooks/UseMediaQuery';
import { RESPONSIVE_BREAKPOINTS, RESPONSIVE_BREAKPOINT_MD, RESPONSIVE_BREAKPOINT_XS } from '../data/constants/Breakpoints';

const LEND_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const LendHeaderContainer = styled.div`
  ${tw`flex justify-between`}
`;

const LendHeader = styled.div`
  ${tw`flex flex-col justify-between`}

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    gap: 64px;
  }
`;

const LowerLendHeader = styled.div`
  display: flex;
  align-items: center;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const LendCards = styled.div`
  ${tw`flex flex-col`}
  row-gap: 24px;
  margin-top: 24px;
`;

const filterOptions: MultiDropdownOption[] = getTokens().map((token) => {
  return {
    value: token.address,
    label: token.ticker,
    icon: token.iconPath,
  } as MultiDropdownOption;
});

export default function LendPage() {
  // MARK: component state
  const [tokenQuotes, setTokenQuotes] = useState<TokenQuote[]>([]);
  const [lendingPairs, setLendingPairs] = useState<LendingPair[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedOptions, setSelectedOptions] = useState<MultiDropdownOption[]>(filterOptions);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(10);

  // MARK: wagmi hooks
  const provider = useProvider(/*{ chainId: 5 }*/);
  const { address, connector } = useAccount();
  const { data: ensName } = useEnsName({
    address: address,
    chainId: chain.mainnet.id,
  });

  const chartData = [];
  for (let i = 0; i < 100; i++) {
    chartData.push(i);
  }

  const apy = 5.54;

  useEffectOnce(() => {
    let mounted = true;
    async function fetch() {
      // fetch token quotes
      const quoteDataResponse: AxiosResponse = await axios.get(API_PRICE_RELAY_URL);
      const prResponse: PriceRelayResponse = quoteDataResponse.data;
      if (!prResponse || !prResponse.data) {
        return;
      }
      const tokenQuoteData: TokenQuote[] = Object.values(prResponse.data).map((pr: any) => {
        return {
          token: GetTokenData(pr?.platform?.token_address || ''),
          price: pr?.quote['USD']?.price || 0,
        };
      });
      if (mounted) {
        setTokenQuotes(tokenQuoteData);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  });

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const results = await getAvailableLendingPairs(provider, address || '');
      if (mounted) {
        setLendingPairs(results);
        setIsLoading(false);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [provider, connector, address]);

  // Flatten pairs into a single array of token balances
  const tokenBalances: TokenBalance[] = useMemo(() => {
    return lendingPairs.flatMap((pair) => {
      return [
        {
          token: pair.token0,
          balance: pair.token0Balance,
        },
        {
          token: pair.token1,
          balance: pair.token1Balance,
        },
        {
          token: pair.kitty0,
          balance: pair.kitty0Balance,
        },
        {
          token: pair.kitty1,
          balance: pair.kitty1Balance,
        },
      ];
    });
  }, [lendingPairs]);

  // Combine token balances with token quotes (token, balance, balanceUSD)
  const tokenBalancesUSD = useMemo(() => {
    if (tokenBalances.length === 0 || tokenQuotes.length === 0) {
      return [];
    }
    // Coalesce corresponding token/token+ quote data (same mainnet address)
    const tokenBalancesUSDDict: { [key: string]: TokenBalanceUSD } = {};
    tokenBalances.forEach((tokenBalance: TokenBalance) => {
      const tokenAddress = tokenBalance.token?.referenceAddress ?? tokenBalance.token.address;
      const correspondingQuote = tokenQuotes.find((tokenQuote: TokenQuote) => {
        return tokenQuote.token.address === tokenAddress;
      });
      const correspondingPrice = correspondingQuote?.price || 0;
      const existingEntry = tokenBalancesUSDDict[tokenAddress];
      if (existingEntry) {
        tokenBalancesUSDDict[tokenAddress].balance += tokenBalance.balance;
        tokenBalancesUSDDict[tokenAddress].balanceUSD += tokenBalance.balance * correspondingPrice;
      } else {
        tokenBalancesUSDDict[tokenAddress] = {
          token: GetTokenData(tokenAddress),
          balance: tokenBalance.balance,
          balanceUSD: tokenBalance.balance * correspondingPrice,
        };
      }
    });
    // Convert from dict to array
    return Object.values(tokenBalancesUSDDict);
  }, [tokenBalances, tokenQuotes]);

  // Calculate total USD value of all tokens
  const totalBalanceUSD = useMemo(() => {
    return tokenBalancesUSD.reduce((acc, tokenBalanceUSD) => {
      return acc + tokenBalanceUSD.balanceUSD;
    }, 0);
  }, [tokenBalancesUSD]);

  const isGTMediumScreen = useMediaQuery(RESPONSIVE_BREAKPOINTS.MD);

  return (
    <AppPage>
      <div className='flex flex-col gap-6'>
        <LendHeaderContainer>
          <LendHeader>
            <Text size='XXL' weight='bold'>
              <p>{ensName ? `Hi, ${ensName}.` : 'Hi!'}</p>
              <p>Your balance is {formatUSD(totalBalanceUSD)}</p>
              <p>and is growing at</p>
              <p>{roundPercentage(apy)}% APY.</p>
            </Text>
            <LowerLendHeader>
              <MultiDropdownButton
                options={filterOptions}
                activeOptions={selectedOptions}
                handleChange={(updatedOptions: MultiDropdownOption[]) => {
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
                      onChange={(e) => {
                        props.onSearch(e.target.value);
                      }}
                      Icon={<SearchIcon />}
                      size='M'
                      svgColorType='stroke'
                    />
                  );
                }}
                flipDirection={true}
              />
              <BalanceSlider tokenBalances={tokenBalances} />
            </LowerLendHeader>
          </LendHeader>
          {isGTMediumScreen && (
            <LendPieChartWidget tokenBalancesUSD={tokenBalancesUSD} totalBalanceUSD={totalBalanceUSD} />
          )}
        </LendHeaderContainer>
        <Divider />
        <div>
          <div className='flex items-center gap-2'>
            <Text size='L' weight='bold' color={LEND_TITLE_TEXT_COLOR}>
              Lending Pairs
            </Text>
            <Tooltip buttonSize='M' buttonText='' content='test' position='top-center' filled={true} />
          </div>
          <LendCards>
            {lendingPairs.map((lendPair) => (
              <LendPairCard key={lendPair.token0.address} {...lendPair} />
            ))}
          </LendCards>
          <Pagination
            totalItems={lendingPairs.length}
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
      </div>
    </AppPage>
  );
}
