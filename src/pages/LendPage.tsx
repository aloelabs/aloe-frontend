import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import { FilledGreyButtonWithIcon } from '../components/common/Buttons';
import { Text } from '../components/common/Typography';
import BalanceSlider from '../components/lend/BalanceSlider';
import { GetTokenData } from '../data/TokenData';
import { formatUSD, roundPercentage } from '../util/Numbers';
import { ReactComponent as FilterIcon } from '../assets/svg/filter.svg';
import { Divider } from '../components/common/Divider';
import Tooltip from '../components/common/Tooltip';
import LendPairCard from '../components/lend/LendPairCard';
import { FeeTier } from '../data/BlendPoolMarkers';
import YieldAggregatorCard from '../components/lend/YieldAggregatorCard';
import Pagination, { ItemsPerPage } from '../components/common/Pagination';
import LendPortfolioWidget from '../components/lend/LendPortfolioWidget';

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

export default function LendPage() {
  const chartData = [];
  for (let i = 0; i < 100; i++) {
    chartData.push(i);
  }
  const name = 'haydenshively.eth';
  const balance = 1000.01;
  const apy = 5.54;

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
              <FilledGreyButtonWithIcon
                Icon={<FilterIcon />}
                size='M'
                svgColorType='stroke'
                position='leading'
              >
                Filter
              </FilledGreyButtonWithIcon>
              <BalanceSlider
                tokenBalances={[
                  {
                    token: GetTokenData(
                      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
                    ),
                    balance: '0.00',
                  },
                  {
                    token: GetTokenData(
                      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
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
          <LendPortfolioWidget />
        </LendHeaderContainer>
        <Divider />
        <div>
          <div className='flex items-center gap-2'>
            <Text size='L' weight='bold' color={LEND_TITLE_TEXT_COLOR}>Lending Pairs</Text>
            <Tooltip buttonSize='M' buttonText='' content='test' position='bottom-center' filled={true}  />
          </div>
          <LendCards>
            <LendPairCard 
              token0={GetTokenData('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')}
              token1={GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')}
              token0APY={5.54}
              token1APY={5.54}
              token0TotalSupply={1000.01}
              token1TotalSupply={1000.01}
              token0Utilization={70.5}
              token1Utilization={70.5}
              uniswapFeeTier={FeeTier.ZERO_ZERO_FIVE}
            />
            <LendPairCard 
              token0={GetTokenData('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599')}
              token1={GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')}
              token0APY={5.54}
              token1APY={5.54}
              token0TotalSupply={1000.01}
              token1TotalSupply={1000.01}
              token0Utilization={70.5}
              token1Utilization={70.5}
              uniswapFeeTier={FeeTier.ZERO_ZERO_FIVE}
            />
            <LendPairCard 
              token0={GetTokenData('0x03ab458634910aad20ef5f1c8ee96f1d6ac54919')}
              token1={GetTokenData('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')}
              token0APY={5.54}
              token1APY={5.54}
              token0TotalSupply={1000.01}
              token1TotalSupply={1000.01}
              token0Utilization={70.5}
              token1Utilization={70.5}
              uniswapFeeTier={FeeTier.ZERO_ZERO_FIVE}
            />
            <YieldAggregatorCard
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
            />
          </LendCards>
          <Pagination totalItems={10} currentPage={1} itemsPerPage={10} loading={false} onPageChange={(page: number) => {}} onItemsPerPageChange={(itemsPerPage: ItemsPerPage) => {}} />
        </div>
      </div>
    </AppPage>
  );
}
