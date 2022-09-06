import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import { Display } from '../components/common/Typography';
import { MarginAccountCard } from '../components/borrow/MarginAccountCard';
import { GetTokenData } from '../data/TokenData';
import { FeeTier } from '../data/FeeTier';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import { FilledGradientButtonWithIcon } from '../components/common/Buttons';
import { useAccount, useContract, useProvider, useSigner } from 'wagmi';
import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import Big from 'big.js';
import { Assets, Liabilities, MarginAccount } from '../data/MarginAccount';
import { BigNumber, ethers } from 'ethers';
import useEffectOnce from '../data/hooks/UseEffectOnce';
import { makeEtherscanRequest } from '../util/Etherscan';
import { createMarginAccount } from '../connector/FactoryActions';
import CreateMarginAccountModal from '../components/borrow/modal/CreateMarginAccountModal';
import CreatedMarginAccountModal from '../components/borrow/modal/CreatedMarginAccountModal';
import FailedTxnModal from '../components/borrow/modal/FailedTxnModal';
import PendingTxnModal from '../components/borrow/modal/PendingTxnModal';

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
async function getMarginAccountsForUser(userAddress: string, provider: ethers.providers.Provider): Promise<string[]> {
  const etherscanResult = await makeEtherscanRequest(
    7537163,
    '0x9F6d4681fD8c557e5dC75b6713078233e98CA351',
    ['0x2e4e957c1260adb001f2d118cbfb21f455e78760f52247e8b9490521ac2254aa'],
    true,
    'api-goerli'
  );
  if (!etherscanResult.data.result) return [];

  const accounts: string[] = etherscanResult.data.result.map((item: any) => {
    const address: string = item.topics[2];
    return address.slice(26);
  });

  const accountOwners = await Promise.all(accounts.map((account) => {
    const contract = new ethers.Contract(account, MarginAccountABI, provider);
    return contract.OWNER();
  }));

  return accounts.filter((_, i) => accountOwners[i] === userAddress);
}

export default function BorrowAccountsPage() {
  // MARK: Stuff for deploying a new MarginAccount
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [showSubmittingModal, setShowSubmittingModal] = useState(false);
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  const [{ data: signer }] = useSigner();

  const [marginAccounts, setMarginAccounts] = useState<Array<MarginAccount>>([]);
  const provider = useProvider();
  const [{ data: accountData }] = useAccount();

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
    let mounted = true;

    async function fetch() {
      const fetchedMarginAccounts = accountData ? await getMarginAccountsForUser(accountData.address, provider) : [];

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
          token0Plus: Big(assetsData[4].toString()).div(10 ** token0.decimals).toNumber(),
          token1Plus: Big(assetsData[5].toString()).div(10 ** token1.decimals).toNumber(),
          uni0: Big(assetsData[2].toString()).div(10 ** token0.decimals).toNumber(),
          uni1: Big(assetsData[3].toString()).div(10 ** token1.decimals).toNumber(),
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
      if (mounted) {
        setMarginAccounts(updatedMarginAccounts);
      }
    }
    fetch();
    return () => {
      mounted = false;
    }
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
          onClick={() => {
            setShowConfirmModal(true);
          }}
        >
          New
        </FilledGradientButtonWithIcon>
      </div>
      <MarginAccountsContainner>
        {marginAccounts.map((marginAccount: MarginAccount, index: number) => (
          <MarginAccountCard
            key={index}
            {...marginAccount}
          />
        ))}
      </MarginAccountsContainner>

      <CreateMarginAccountModal
        availablePools={[
          {label: 'USDC/WETH 0.05%', value: '0xfBe57C73A82171A773D3328F1b563296151be515'},
        ]}
        open={showConfirmModal}
        setOpen={setShowConfirmModal}
        onConfirm={(selectedPool: string | null) => {
          console.log(selectedPool);
          setShowConfirmModal(false);
          setShowSubmittingModal(true);
          if (!signer || !accountData || !selectedPool) {
            setIsTransactionPending(false);
            return;
          }
          createMarginAccount(
            signer,
            selectedPool,
            accountData.address,
            (receipt) => {
              setShowSubmittingModal(false);
              if (receipt?.status === 1) {
                setShowSuccessModal(true);
              } else {
                setShowFailedModal(true);
              }
              setIsTransactionPending(false);
              console.log(receipt);
            }
          );
        }}
        onCancel={() => {
          setIsTransactionPending(false);
        }}
      />
      <CreatedMarginAccountModal
        open={showSuccessModal}
        setOpen={setShowSuccessModal}
      />
      <FailedTxnModal
        open={showFailedModal}
        setOpen={setShowFailedModal}
      />
      <PendingTxnModal
        open={showSubmittingModal}
        setOpen={setShowSubmittingModal}
      />
    </AppPage>
  );
}
