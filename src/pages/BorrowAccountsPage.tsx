import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import AppPage from '../components/common/AppPage';
import { Display } from '../components/common/Typography';
import { MarginAccountCard } from '../components/borrow/MarginAccountCard';
import { GetTokenData } from '../data/TokenData';
import { FeeTier, NumericFeeTierToEnum } from '../data/FeeTier';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import { FilledGradientButtonWithIcon } from '../components/common/Buttons';
import { useAccount, useContract, useNetwork, useProvider, useSigner } from 'wagmi';
import Big from 'big.js';
import { Assets, Liabilities, MarginAccount } from '../data/MarginAccount';
import { BigNumber, ethers } from 'ethers';
import { makeEtherscanRequest } from '../util/Etherscan';
import { createMarginAccount } from '../connector/FactoryActions';
import CreateMarginAccountModal from '../components/borrow/modal/CreateMarginAccountModal';
import CreatedMarginAccountModal from '../components/borrow/modal/CreatedMarginAccountModal';
import FailedTxnModal from '../components/borrow/modal/FailedTxnModal';
import PendingTxnModal from '../components/borrow/modal/PendingTxnModal';

import MarginAccountABI from '../assets/abis/MarginAccount.json';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';

const MarginAccountsContainner = styled.div`
  ${tw`flex items-center justify-start flex-wrap gap-4`}
`;

//TODO: move this function to where it belongs
async function getMarginAccountsForUser(
  userAddress: string,
  provider: ethers.providers.Provider
): Promise<{ address: string; uniswapPool: string }[]> {
  const etherscanResult = await makeEtherscanRequest(
    7537163,
    '0x9F6d4681fD8c557e5dC75b6713078233e98CA351', // TODO replace with constant for FACTORY address
    ['0x2e4e957c1260adb001f2d118cbfb21f455e78760f52247e8b9490521ac2254aa'],
    true,
    'api-goerli'
  );
  if (!Array.isArray(etherscanResult.data.result)) return [];

  const accounts: { address: string; uniswapPool: string }[] = etherscanResult.data.result.map((item: any) => {
    return {
      address: item.topics[2].slice(26),
      uniswapPool: item.topics[1].slice(26),
    };
  });

  const accountOwners = await Promise.all(
    accounts.map((account) => {
      const contract = new ethers.Contract(account.address, MarginAccountABI, provider);
      return contract.OWNER();
    })
  );

  return accounts.filter((_, i) => accountOwners[i] === userAddress);
}

export default function BorrowAccountsPage() {
  // MARK: component state
  // --> transaction modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [showSubmittingModal, setShowSubmittingModal] = useState(false);
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  // --> other
  const [marginAccounts, setMarginAccounts] = useState<MarginAccount[]>([]);

  // MARK: wagmi hooks
  const provider = useProvider();
  const { chain } = useNetwork();
  const { address } = useAccount();
  const { data: signer } = useSigner();
  const marginAccountLensContract = useContract({
    addressOrName: '0xFc9A50F2dD9348B5a9b00A21B09D9988bd9726F7',
    contractInterface: MarginAccountLensABI,
    signerOrProvider: provider,
  });

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const fetchedMarginAccounts = address ? await getMarginAccountsForUser(address, provider) : [];

      // there may be multiple margin accounts per Uniswap Pool. make sure we don't fetch Uniswap Pool info more than once
      const uniqueUniswapPools = new Set(fetchedMarginAccounts.map((x) => x.uniswapPool));
      // create an array to hold all the Promises we're about to create
      const uniswapPoolData: Promise<[string, { token0: string; token1: string; feeTier: number }]>[] = [];
      // for each pool, create a Promise that returns a tuple: (poolAddress, otherData)
      uniqueUniswapPools.forEach((pool) => {
        async function getUniswapPoolData(): Promise<[string, { token0: string; token1: string; feeTier: number }]> {
          const contract = new ethers.Contract(pool, UniswapV3PoolABI, provider);
          const [token0, token1, feeTier] = await Promise.all([contract.token0(), contract.token1(), contract.fee()]);
          //     |key|  |          value           |
          return [pool, { token0, token1, feeTier }];
        }
        uniswapPoolData.push(getUniswapPoolData());
      });
      // resolve all the Promised tuples and turn them into a Map
      const uniswapPoolDataMap = Object.fromEntries(await Promise.all(uniswapPoolData));

      const marginAccountPromises: Promise<MarginAccount>[] = fetchedMarginAccounts.map(
        async ({ address: accountAddress, uniswapPool }) => {
          const token0 = GetTokenData(uniswapPoolDataMap[uniswapPool].token0);
          const token1 = GetTokenData(uniswapPoolDataMap[uniswapPool].token1);
          const feeTier = NumericFeeTierToEnum(uniswapPoolDataMap[uniswapPool].feeTier);

          const assetsData: BigNumber[] = await marginAccountLensContract.getAssets(accountAddress);
          const liabilitiesData: BigNumber[] = await marginAccountLensContract.getLiabilities(accountAddress);
          const assets: Assets = {
            token0Raw: Big(assetsData[0].toString())
              .div(10 ** token0.decimals)
              .toNumber(),
            token1Raw: Big(assetsData[1].toString())
              .div(10 ** token1.decimals)
              .toNumber(),
            token0Plus: Big(assetsData[4].toString())
              .div(10 ** 18)
              .toNumber(),
            token1Plus: Big(assetsData[5].toString())
              .div(10 ** 18)
              .toNumber(),
            uni0: Big(assetsData[2].toString())
              .div(10 ** token0.decimals)
              .toNumber(),
            uni1: Big(assetsData[3].toString())
              .div(10 ** token1.decimals)
              .toNumber(),
          };
          const liabilities: Liabilities = {
            amount0: Big(liabilitiesData[0].toString())
              .div(10 ** token0.decimals)
              .toNumber(),
            amount1: Big(liabilitiesData[1].toString())
              .div(10 ** token1.decimals)
              .toNumber(),
          };
          return { address: accountAddress, token0, token1, feeTier, assets, liabilities };
        }
      );
      const updatedMarginAccounts = await Promise.all(marginAccountPromises);
      if (mounted) {
        setMarginAccounts(updatedMarginAccounts);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
    //TODO: temporary while we need metamask to fetch this info
  }, [address, marginAccountLensContract, chain, provider]);

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
          <MarginAccountCard key={index} {...marginAccount} />
        ))}
      </MarginAccountsContainner>

      <CreateMarginAccountModal
        availablePools={[{ label: 'USDC/WETH 0.05%', value: '0xfBe57C73A82171A773D3328F1b563296151be515' }]}
        open={showConfirmModal}
        setOpen={setShowConfirmModal}
        onConfirm={(selectedPool: string | null) => {
          console.log(selectedPool);
          setShowConfirmModal(false);
          setShowSubmittingModal(true);
          if (!signer || !address || !selectedPool) {
            setIsTransactionPending(false);
            return;
          }
          createMarginAccount(signer, selectedPool, address, (receipt) => {
            setShowSubmittingModal(false);
            if (receipt?.status === 1) {
              setShowSuccessModal(true);
            } else {
              setShowFailedModal(true);
            }
            setIsTransactionPending(false);
            console.log(receipt);
          });
        }}
        onCancel={() => {
          setIsTransactionPending(false);
        }}
      />
      <CreatedMarginAccountModal open={showSuccessModal} setOpen={setShowSuccessModal} />
      <FailedTxnModal open={showFailedModal} setOpen={setShowFailedModal} />
      <PendingTxnModal open={showSubmittingModal} setOpen={setShowSubmittingModal} />
    </AppPage>
  );
}
