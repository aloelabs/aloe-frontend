import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import { FilledGreyButtonWithIcon } from '../components/common/Buttons';
import { Text } from '../components/common/Typography';
import BalanceSlider from '../components/lend/BalanceSlider';
import { GetTokenData, getTokens } from '../data/TokenData';
import { formatUSD, roundPercentage } from '../util/Numbers';
import { ReactComponent as FilterIcon } from '../assets/svg/filter.svg';
import { Divider } from '../components/common/Divider';
import Tooltip from '../components/common/Tooltip';
import LendPairCard, { LendPairCardProps } from '../components/lend/LendPairCard';
import { FeeTier } from '../data/FeeTier';
import YieldAggregatorCard from '../components/lend/YieldAggregatorCard';
import Pagination, { ItemsPerPage } from '../components/common/Pagination';
import {
  MultiDropdownButton,
  MultiDropdownOption,
} from '../components/common/Dropdown';
import { SquareInputWithIcon } from '../components/common/Input';
import { ReactComponent as SearchIcon } from '../assets/svg/search.svg';

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
  const chartData = [];
  for (let i = 0; i < 100; i++) {
    chartData.push(i);
  }
  const name = 'haydenshively.eth';
  const balance = 1000.01;
  const apy = 5.54;
  const [selectedOptions, setSelectedOptions] =
    React.useState<MultiDropdownOption[]>(filterOptions);
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = React.useState<ItemsPerPage>(10);

  const lendPairs: LendPairCardProps[] = [
    {
      token0: GetTokenData('0x3c80ca907ee39f6c3021b66b5a55ccc18e07141a'),
      token1: GetTokenData('0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6'),
      token0APY: 5.54,
      token1APY: 5.54,
      token0TotalSupply: 1000.01,
      token1TotalSupply: 1000.01,
      token0Utilization: 0.5,
      token1Utilization: 0.5,
      uniswapFeeTier: FeeTier.ZERO_ZERO_FIVE,
    },
    // {
    //   token0: GetTokenData('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'),
    //   token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
    //   token0APY: 5.54,
    //   token1APY: 5.54,
    //   token0TotalSupply: 1000.01,
    //   token1TotalSupply: 1000.01,
    //   token0Utilization: 0.5,
    //   token1Utilization: 0.5,
    //   uniswapFeeTier: FeeTier.ZERO_THREE,
    // },
    // {
    //   token0: GetTokenData('0x03ab458634910aad20ef5f1c8ee96f1d6ac54919'),
    //   token1: GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
    //   token0APY: 5.54,
    //   token1APY: 5.54,
    //   token0TotalSupply: 1000.01,
    //   token1TotalSupply: 1000.01,
    //   token0Utilization: 0.5,
    //   token1Utilization: 0.5,
    //   uniswapFeeTier: FeeTier.ZERO_THREE,
    // }
  ];

  return (
    <AppPage>
      <div className='flex flex-col gap-6'>
        <LendHeaderContainer>
          <div className='flex flex-col justify-between'>
            <Text size='XL' weight='bold'>
              <p>Hi, {name}.</p>
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
            {lendPairs.map((lendPair) => (
              <LendPairCard key={lendPair.token0.address} {...lendPair} />
            ))}
            {/* <YieldAggregatorCard
              tokens={[
                GetTokenData('0x03ab458634910aad20ef5f1c8ee96f1d6ac54919'),
                GetTokenData('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'),
                GetTokenData('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
                GetTokenData('0xf4d2888d29d722226fafa5d9b24f9164c092421e'),
                GetTokenData('0xc7283b66eb1eb5fb86327f08e1b5816b0720212b'),
                GetTokenData('0x03ab458634910aad20ef5f1c8ee96f1d6ac54919'),
                GetTokenData('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'),
                GetTokenData('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
                GetTokenData('0xf4d2888d29d722226fafa5d9b24f9164c092421e'),
                GetTokenData('0xc7283b66eb1eb5fb86327f08e1b5816b0720212b'),
              ]}
              totalAPY={5.54}
              totalSupply={1000.01}
              totalUtilization={70.5}
            /> */}
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
