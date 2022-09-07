import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import { FilledGreyButtonWithIcon } from '../components/common/Buttons';
import { Text } from '../components/common/Typography';
import BalanceSlider from '../components/lend/BalanceSlider';
import { GetTokenData, getTokens, TokenData } from '../data/TokenData';
import { formatUSD, roundPercentage } from '../util/Numbers';
import { ReactComponent as FilterIcon } from '../assets/svg/filter.svg';
import { Divider } from '../components/common/Divider';
import Tooltip from '../components/common/Tooltip';
import LendPairCard, { LendPairCardProps } from '../components/lend/LendPairCard';
import { FeeTier, NumericFeeTierToEnum } from '../data/FeeTier';
import YieldAggregatorCard from '../components/lend/YieldAggregatorCard';
import Pagination, { ItemsPerPage } from '../components/common/Pagination';
import {
  MultiDropdownButton,
  MultiDropdownOption,
} from '../components/common/Dropdown';
import { SquareInputWithIcon } from '../components/common/Input';
import { ReactComponent as SearchIcon } from '../assets/svg/search.svg';
import { chain, useAccount, useEnsName, useNetwork, useProvider } from 'wagmi';
import { ethers } from 'ethers';
import { makeEtherscanRequest } from '../util/Etherscan';

import KittyABI from '../assets/abis/Kitty.json';
import KittyLensABI from '../assets/abis/KittyLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';

import Big from 'big.js';

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

//TODO: move this function to where it belongs
async function getAvailableLendingPairs(provider: ethers.providers.Provider): Promise<LendPairCardProps[]> {
  const etherscanResult = await makeEtherscanRequest(
    7537163,
    '0x9F6d4681fD8c557e5dC75b6713078233e98CA351', // TODO replace with constant for FACTORY address
    ['0x3f53d2c2743b2b162c0aa5d678be4058d3ae2043700424be52c04105df3e2411'],
    true,
    'api-goerli'
  );
  console.log(etherscanResult.data);
  if (!Array.isArray(etherscanResult.data.result)) return [];

  //TODO: KITTY LENS (TEMPORARY): 0x723bfe564661536fdffa3e9e060135928d3bf18f

  const addresses: {pool: string, kitty0: string, kitty1: string}[] = etherscanResult.data.result.map((item: any) => {
    return {
      pool: item.topics[1].slice(26),
      kitty0: item.topics[2].slice(26),
      kitty1: item.topics[3].slice(26)
    };
  });

  const kittyLens = new ethers.Contract('0x723bfe564661536fdffa3e9e060135928d3bf18f', KittyLensABI, provider);

  return await Promise.all(addresses.map(async (market) => {
    const uniswapPool = new ethers.Contract(market.pool, UniswapV3PoolABI, provider);

    const [result0, result1, result2] = await Promise.all([
      kittyLens.readBasics(market.kitty0),
      kittyLens.readBasics(market.kitty1),
      uniswapPool.fee(),
    ]);

    const token0 = GetTokenData(result0.asset);
    const token1 = GetTokenData(result1.asset);
    const kitty0: TokenData = {
      address: market.kitty0,
      decimals: 18,
      iconPath: token0.iconPath,
      name: `Aloe II ${token0.name ?? 'Token'}`,
      ticker: token0.ticker ? `${token0.ticker}+` : undefined,
    }
    const kitty1: TokenData = {
      address: market.kitty1,
      decimals: 18,
      iconPath: token1.iconPath,
      name: `Aloe II ${token1.name ?? 'Token'}`,
      ticker: token1.ticker ? `${token1.ticker}+` : undefined,
    }

    const interestRate0 = new Big(result0.interestRate.toString());
    const interestRate1 = new Big(result1.interestRate.toString());
    const APY0 = (interestRate0.div(10 ** 18).plus(1.0).toNumber() ** (365 * 24 * 60 * 60)) - 1.0;
    const APY1 = (interestRate1.div(10 ** 18).plus(1.0).toNumber() ** (365 * 24 * 60 * 60)) - 1.0;

    return {
      token0,
      token1,
      kitty0,
      kitty1,
      token0APY: APY0,
      token1APY: APY1,
      token0TotalSupply: new Big(result0.inventory.toString()).div(10 ** token0.decimals).toNumber(),
      token1TotalSupply: new Big(result1.inventory.toString()).div(10 ** token1.decimals).toNumber(),
      token0Utilization: new Big(result0.utilization.toString()).div(10 ** 18).toNumber(),
      token1Utilization: new Big(result1.utilization.toString()).div(10 ** 18).toNumber(),
      uniswapFeeTier: NumericFeeTierToEnum(result2),
    };
  }));
}

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
  // const { chain: currentChain, chains: availableChains } = useNetwork()
  // console.log(currentChain);
  // console.log(availableChains);

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
