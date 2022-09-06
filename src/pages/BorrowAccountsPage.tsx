import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import { Display, Text } from '../components/common/Typography';
import { MarginAccountCard } from '../components/borrow/MarginAccountCard';
import { GetTokenData } from '../data/TokenData';
import { FeeTier } from '../data/FeeTier';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import { FilledGradientButtonWithIcon } from '../components/common/Buttons';
import { useContract, useProvider } from 'wagmi';
import MarginAccountABI from '../assets/abis/MarginAccount.json'
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json'
import Big from 'big.js';
import { Assets, Liabilities, MarginAccount } from '../data/MarginAccount';
import { BigNumber } from 'ethers';
import useEffectOnce from '../data/hooks/UseEffectOnce';

const DEMO_MARGIN_ACCOUNTS = [
  {
    token0: GetTokenData('0x3c80ca907ee39f6c3021b66b5a55ccc18e07141a'),
    token1: GetTokenData('0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6'),
    feeTier: FeeTier.ZERO_ZERO_FIVE,
    id: '1234',
  },
];

const MarginAccountsContainner = styled.div`
  ${tw`flex items-center justify-start flex-wrap gap-4`}
`;

//TODO: move this function to where it belongs
async function getMarginAccountsForUser() {
  //TODO: use etherscan to get an actual list of margin accounts for a user
  return Promise.resolve(['0x63761a7397E51b5C49D55BFcf4bf3709E0c1df58'])
}

export default function BorrowAccountsPage() {
  const [marginAccounts, setMarginAccounts] = useState<Array<MarginAccount>>([]);
  const provider = useProvider();
  const marginAccountLensContract = useContract({
    addressOrName: '0xFc9A50F2dD9348B5a9b00A21B09D9988bd9726F7',
    contractInterface: MarginAccountLensABI,
    signerOrProvider: provider,
  });
  // const marginAccountContract = useContract({
  //   addressOrName: '0x63761a7397E51b5C49D55BFcf4bf3709E0c1df58',
  //   contractInterface: MarginAccountABI,
  //   signerOrProvider: provider,
  // });
  //etherscan query to get list of accounts I created (and to display)
  //for each account:
  //  - get token addresses => TokenData (name, label, icon, etc)
  //  - get assets/liabilities
  useEffectOnce(() => {
    async function fetch() {
      const fetchedMarginAccounts = await getMarginAccountsForUser();
      const marginAccountPromises: Promise<MarginAccount>[] = fetchedMarginAccounts.map(async (fetchedMarginAccount: string) => {
        //TODO: use the marginAccountContract to get the TokenData
        const token0Address = '0x3c80ca907ee39f6c3021b66b5a55ccc18e07141a';
        const token1Address = '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6';
        const token0 = GetTokenData(token0Address);
        const token1 = GetTokenData(token1Address);
        const feeTier = FeeTier.ZERO_ZERO_FIVE;
        const assetsData: BigNumber[] = await marginAccountLensContract.getAssets(fetchedMarginAccount);
        const liabilitiesData: BigNumber[] = await marginAccountLensContract.getLiabilities(fetchedMarginAccount);
        const assets: Assets = {
          token0Raw: Big(assetsData[0].toString()).div(10 ** token0.decimals).toNumber(),
          token1Raw: Big(assetsData[1].toString()).div(10 ** token1.decimals).toNumber(),
          token0Debt: Big(assetsData[2].toString()).div(10 ** token0.decimals).toNumber(),
          token1Debt: Big(assetsData[3].toString()).div(10 ** token1.decimals).toNumber(),
          token0Plus: Big(assetsData[4].toString()).div(10 ** token0.decimals).toNumber(),
          token1Plus: Big(assetsData[5].toString()).div(10 ** token1.decimals).toNumber(),
        }
        const liabilities: Liabilities = {
          amount0: Big(liabilitiesData[0].toString()).div(10 ** token0.decimals).toNumber(),
          amount1: Big(liabilitiesData[1].toString()).div(10 ** token1.decimals).toNumber(),
        }
        return {
          address: fetchedMarginAccount,
          token0: token0,
          token1: token1,
          feeTier: feeTier,
          assets: assets,
          liabilities: liabilities,
        }
      });
      const updatedMarginAccounts = await Promise.all(marginAccountPromises);
      setMarginAccounts(updatedMarginAccounts);
    }
    fetch();
  });
  return (
    <AppPage>
      <div className='flex gap-8 items-center mb-4'>
        <Display size='L' weight='semibold'>
          Your Margin Accounts
        </Display>
        <FilledGradientButtonWithIcon
          Icon={<PlusIcon />}
          position='leading'
          size='S'
          svgColorType='stroke'
          onClick={() => {}}
        >
          New
        </FilledGradientButtonWithIcon>
      </div>
      <MarginAccountsContainner>
        {marginAccounts.map((marginAccount: MarginAccount, index: number) => (
          <MarginAccountCard
            token0={marginAccount.token0}
            token1={marginAccount.token1}
            feeTier={marginAccount.feeTier}
            id={marginAccount.address}
            key={index}
          />
        ))}
      </MarginAccountsContainner>
    </AppPage>
  );
}
