import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import { FilledGreyButtonWithIcon } from '../components/common/Buttons';
import { Text } from '../components/common/Typography';
import BalanceSlider, { TokenBalance } from '../components/lend/BalanceSlider';
import { GetTokenData, getTokens, TokenQuote, TokenBalanceUSD } from '../data/TokenData';
import { formatUSD, roundPercentage } from '../util/Numbers';
import { ReactComponent as FilterIcon } from '../assets/svg/filter.svg';
import { Divider } from '../components/common/Divider';
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

const LEND_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const LendHeaderContainer = styled.div`
  ${tw`flex justify-between`}
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

// function calculateTokenBalancesUSD(tokenBalances: TokenBalance[], tokenQuotes: TokenQuote[]): TokenBalanceUSD[] {
//   console.log('tokenBalances', tokenBalances);
//   if (tokenBalances.length === 0 || tokenQuotes.length === 0) {
//     return [];
//   }
//   const tokenBalancesUSDDict: { [key: string]: TokenBalanceUSD } = {};
//   tokenBalances.forEach((tokenBalance: TokenBalance) => {
//     const tokenAddress = tokenBalance.token?.referenceAddress ?? tokenBalance.token.address;
//     const correspondingQuote = tokenQuotes.find((tokenQuote: TokenQuote) => {
//       return tokenQuote.token.address === tokenAddress;
//     });
//     const correspondingPrice = correspondingQuote?.price || 0;
//     const numericBalance = parseFloat(tokenBalance.balance);
//     const existingEntry = tokenBalancesUSDDict[tokenAddress];
//     if (existingEntry) {
//       tokenBalancesUSDDict[tokenAddress].balance += numericBalance;
//       tokenBalancesUSDDict[tokenAddress].balanceUSD += numericBalance * correspondingPrice;
//     } else {
//       tokenBalancesUSDDict[tokenAddress] = {
//         token: GetTokenData(tokenAddress),
//         balance: numericBalance,
//         balanceUSD: numericBalance * correspondingPrice,
//       }
//     }
//   });
//   return Object.values(tokenBalancesUSDDict);
// }

export default function LendPage() {
  // MARK: component state
  // const [quoteData, setQuoteData] = useState<
  const [tokenQuotes, setTokenQuotes] = useState<TokenQuote[]>([]);
  const [lendingPairs, setLendingPairs] = useState<LendingPair[]>([]);
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

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const quoteDataResponse: AxiosResponse = await axios.get('https://api-price.aloe.capital/price-relay');
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
  }, []);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const results = await getAvailableLendingPairs(provider, address || '');
      if (mounted) {
        setLendingPairs(results);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [provider, connector, address]);

  const tokenBalances: TokenBalance[] = lendingPairs.flatMap((pair) => {
    return [
      {
        token: pair.token0,
        balance: pair.token0Balance.toString(),
      },
      {
        token: pair.token1,
        balance: pair.token1Balance.toString(),
      },
      {
        token: pair.kitty0,
        balance: pair.kitty0Balance.toString(),
      },
      {
        token: pair.kitty1,
        balance: pair.kitty1Balance.toString(),
      },
    ];
  });

  const tokenBalancesUSD = useMemo(() => {
    if (tokenBalances.length === 0 || tokenQuotes.length === 0) {
      return [];
    }
    // Combine corresponding token/token+ quote data
    const tokenBalancesUSDDict: { [key: string]: TokenBalanceUSD } = {};
    tokenBalances.forEach((tokenBalance: TokenBalance) => {
      const tokenAddress = tokenBalance.token?.referenceAddress ?? tokenBalance.token.address;
      const correspondingQuote = tokenQuotes.find((tokenQuote: TokenQuote) => {
        return tokenQuote.token.address === tokenAddress;
      });
      const correspondingPrice = correspondingQuote?.price || 0;
      const numericBalance = parseFloat(tokenBalance.balance);
      const existingEntry = tokenBalancesUSDDict[tokenAddress];
      if (existingEntry) {
        tokenBalancesUSDDict[tokenAddress].balance += numericBalance;
        tokenBalancesUSDDict[tokenAddress].balanceUSD += numericBalance * correspondingPrice;
      } else {
        tokenBalancesUSDDict[tokenAddress] = {
          token: GetTokenData(tokenAddress),
          balance: numericBalance,
          balanceUSD: numericBalance * correspondingPrice,
        };
      }
    });
    return Object.values(tokenBalancesUSDDict);
  }, [tokenBalances, tokenQuotes]);

  const totalBalanceUSD = useMemo(() => {
    return tokenBalancesUSD.reduce((acc, tokenBalanceUSD) => {
      return acc + tokenBalanceUSD.balanceUSD;
    }, 0);
  }, [tokenBalancesUSD]);

  // const totalBalanceUSD = tokenBalancesUSD
  //   .map((tokenBalanceUSD) => {
  //     return tokenBalanceUSD.balanceUSD;
  //   })
  //   .reduce((prev, cur) => prev + cur, 0);

  return (
    <AppPage>
      <div className='flex flex-col gap-6'>
        <LendHeaderContainer>
          <div className='flex flex-col justify-between'>
            <Text size='XL' weight='bold'>
              <p>{ensName ? `Hi, ${ensName}.` : 'Hi!'}</p>
              <p>Your balance is {formatUSD(totalBalanceUSD)}</p>
              <p>and is growing at</p>
              <p>{roundPercentage(apy)}% APY.</p>
            </Text>
            <div className='flex items-center'>
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
            </div>
          </div>
          <LendPieChartWidget tokenBalancesUSD={tokenBalancesUSD} totalBalanceUSD={totalBalanceUSD} />
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
            totalItems={/*TODO*/ 10}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            loading={/*TODO*/ false}
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
