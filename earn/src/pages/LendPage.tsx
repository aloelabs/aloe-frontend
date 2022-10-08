import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGreyButtonWithIcon } from '../components/common/Buttons';
import BalanceSlider from '../components/lend/BalanceSlider';
import { GetTokenData, getTokens, TokenData } from '../data/TokenData';
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
import {
  getAvailableLendingPairs,
  getLendingPairBalances,
  LendingPair,
  LendingPairBalances,
} from '../data/LendingPair';
import LendPieChartWidget from '../components/lend/LendPieChartWidget';
import axios, { AxiosResponse } from 'axios';
import { PriceRelayResponse } from '../data/PriceRelayResponse';
import { API_PRICE_RELAY_URL } from '../data/constants/Values';
import useEffectOnce from '../data/hooks/UseEffectOnce';
import useMediaQuery from '../data/hooks/UseMediaQuery';
import { RESPONSIVE_BREAKPOINTS, RESPONSIVE_BREAKPOINT_XS } from '../data/constants/Breakpoints';
import WelcomeModal from '../components/lend/modal/WelcomeModal';

const WELCOME_MODAL_LOCAL_STORAGE_KEY = 'acknowledged-welcome-modal-lend';
const WELCOME_MODAL_LOCAL_STORAGE_VALUE = 'acknowledged';

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
  }
`;

const LendCards = styled.div`
  ${tw`flex flex-col`}
  row-gap: 24px;
  margin-top: 24px;
`;

export type TokenQuote = {
  token: TokenData;
  price: number;
};

export type TokenBalance = {
  token: TokenData;
  balance: number;
  balanceUSD: number;
  isKitty: boolean;
  apy: number;
  pairName: string;
};

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
  const [lendingPairBalances, setLendingPairBalances] = useState<LendingPairBalances[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedOptions, setSelectedOptions] = useState<MultiDropdownOption[]>(filterOptions);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(10);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffectOnce(() => {
    const shouldShowWelcomeModal =
      localStorage.getItem(WELCOME_MODAL_LOCAL_STORAGE_KEY) !== WELCOME_MODAL_LOCAL_STORAGE_VALUE;
    if (shouldShowWelcomeModal) {
      setShowWelcomeModal(true);
    }
  });

  // MARK: wagmi hooks
  const provider = useProvider({ chainId: chain.goerli.id });
  const { address } = useAccount();
  const { data: ensName } = useEnsName({
    address: address,
    chainId: chain.mainnet.id,
  });

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
      const results = await getAvailableLendingPairs(provider);
      if (mounted) {
        setLendingPairs(results);
        setIsLoading(false);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [provider, address]);

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
        (quote) => quote.token.address === (pair.token0?.referenceAddress || pair.token0.address)
      );
      const token1Quote = tokenQuotes.find(
        (quote) => quote.token.address === (pair.token1?.referenceAddress || pair.token1.address)
      );
      const token0Price = token0Quote?.price || 0;
      const token1Price = token1Quote?.price || 0;
      const pairName = `${pair.token0.ticker}-${pair.token1.ticker}`;
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

  const isGTMediumScreen = useMediaQuery(RESPONSIVE_BREAKPOINTS.MD);

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
              <BalanceSlider tokenBalances={combinedBalances} />
            </LowerLendHeader>
          </LendHeader>
          {isGTMediumScreen && (
            <LendPieChartWidget
              tokenBalances={[...kittyBalances, ...tokenBalances]}
              totalBalanceUSD={totalKittyBalanceUSD + totalTokenBalanceUSD}
            />
          )}
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
              For example, when you deposit to the USDC/WETH lending pair,${' '}
              borrowers can only use your funds if they post USDC or WETH as collateral.${' '}
              Never deposit to a pair that includes unknown/untrustworthy token(s).`}
              position='top-center'
              filled={true}
            />
          </div>
          <LendCards>
            {lendingPairs.map((lendPair, i) => (
              <LendPairCard
                key={lendPair.token0.address}
                {...{
                  ...lendPair,
                  hasDeposited0: (lendingPairBalances?.[i]?.kitty0Balance || 0) > 0,
                  hasDeposited1: (lendingPairBalances?.[i]?.kitty1Balance || 0) > 0,
                }}
              />
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
      <WelcomeModal
        open={showWelcomeModal}
        setOpen={setShowWelcomeModal}
        onConfirm={() => {
          localStorage.setItem(WELCOME_MODAL_LOCAL_STORAGE_KEY, WELCOME_MODAL_LOCAL_STORAGE_VALUE);
        }}
      />
    </AppPage>
  );
}
