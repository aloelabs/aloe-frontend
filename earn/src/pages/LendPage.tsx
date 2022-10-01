import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGreyButtonWithIcon } from '../components/common/Buttons';
import { Text } from '../components/common/Typography';
import BalanceSlider from '../components/lend/BalanceSlider';
import { GetTokenData, getTokens } from '../data/TokenData';
import { formatUSD, roundPercentage } from '../util/Numbers';
import { ReactComponent as FilterIcon } from '../assets/svg/filter.svg';
import { Divider } from '../components/common/Divider';
import Tooltip from '../components/common/Tooltip';
import LendPairCard, { LendPairCardProps } from '../components/lend/LendPairCard';
import Pagination, { ItemsPerPage } from '../components/common/Pagination';
import {
  MultiDropdownButton,
  MultiDropdownOption,
} from '../components/common/Dropdown';
import { SquareInputWithIcon } from '../components/common/Input';
import { ReactComponent as SearchIcon } from '../assets/svg/search.svg';
import { chain, useAccount, useEnsName, useProvider } from 'wagmi';
import { getAvailableLendingPairs } from '../data/LendingPair';

const LEND_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const LendHeaderContainer = styled.div`
  ${tw`flex justify-between`}
`;

const LendChart = styled.div`
  display: grid;
  grid-template-columns: 12px 12px 12px 12px 12px 12px 12px 12px 12px 12px;
  grid-column-gap: 12px;
  grid-row-gap: 12px;
`;

const LendChartItem = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 1px;
  background-color: orange;
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
  const [lendingPairs, setLendingPairs] = useState<LendPairCardProps[]>([]);
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
  
  const balance = 1000.01;
  const apy = 5.54;

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const results = await getAvailableLendingPairs(provider);
      if (mounted) {
        setLendingPairs(results);
      }
    }

    fetch();
    return () => {
      mounted = false;
    }
  }, [provider, connector]);

  return (
    <AppPage>
      <div className='flex flex-col gap-6'>
        <LendHeaderContainer>
          <div className='flex flex-col justify-between'>
            <Text size='XL' weight='bold'>
              <p>{ensName ? `Hi, ${ensName}.` : 'Hi!'}</p>
              <p>Your balance is {formatUSD(balance)}</p>
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
                DropdownButton={(props: {
                  onClick: () => void,
                }) => {
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
                SearchInput={(props: {
                  searchTerm: string,
                  onSearch: (searchTerm: string) => void,
                }) => {
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
                  )
                }}
                flipDirection={true}
              />
              <BalanceSlider
                tokenBalances={[
                  {
                    token: GetTokenData(
                      '0x3c80ca907ee39f6c3021b66b5a55ccc18e07141a'
                    ),
                    balance: '0.00',
                  },
                  {
                    token: GetTokenData(
                      '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6'
                    ),
                    balance: '0.00',
                  },
                  {
                    token: GetTokenData(
                      '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'
                    ),
                    balance: '0.00',
                  },
                ]}
              />
            </div>
          </div>
          <LendChart>
            {chartData.map((data, index) => (
              <LendChartItem key={index} />
            ))}
          </LendChart>
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
              content='test'
              position='top-center'
              filled={true}
            />
          </div>
          <LendCards>
            {lendingPairs.map((lendPair) => (
              <LendPairCard key={lendPair.token0.address} {...lendPair} />
            ))}
          </LendCards>
          <Pagination
            totalItems={/*TODO*/10}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            loading={/*TODO*/false}
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
