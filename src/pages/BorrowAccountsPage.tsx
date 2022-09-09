import { useEffect, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { chain, useAccount, useContract, useNetwork, useProvider, useSigner } from 'wagmi';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import { MarginAccountCard } from '../components/borrow/MarginAccountCard';
import CreatedMarginAccountModal from '../components/borrow/modal/CreatedMarginAccountModal';
import CreateMarginAccountModal from '../components/borrow/modal/CreateMarginAccountModal';
import FailedTxnModal from '../components/borrow/modal/FailedTxnModal';
import PendingTxnModal from '../components/borrow/modal/PendingTxnModal';
import AppPage from '../components/common/AppPage';
import { FilledGradientButtonWithIcon } from '../components/common/Buttons';
import { Display } from '../components/common/Typography';
import { createMarginAccount } from '../connector/FactoryActions';
import {
  fetchMarginAccountPreviews, MarginAccountPreview
} from '../data/MarginAccount';

import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import { useNavigate } from 'react-router-dom';

const MarginAccountsContainner = styled.div`
  ${tw`flex items-center justify-start flex-wrap gap-4`}
`;

export default function BorrowAccountsPage() {
  // MARK: component state
  // --> transaction modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [showSubmittingModal, setShowSubmittingModal] = useState(false);
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  // --> other
  const [marginAccounts, setMarginAccounts] = useState<MarginAccountPreview[]>([]);

  // MARK: wagmi hooks
  const provider = useProvider({ chainId: chain.goerli.id });
  const { address } = useAccount();
  const { data: signer } = useSigner();
  const marginAccountLensContract = useContract({
    addressOrName: '0xFc9A50F2dD9348B5a9b00A21B09D9988bd9726F7',
    contractInterface: MarginAccountLensABI,
    signerOrProvider: provider,
  });

  // MARK: react-router-dom hooks
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function fetch(userAddress: string) {
      const updatedMarginAccounts = await fetchMarginAccountPreviews(marginAccountLensContract, provider, userAddress);
      if (mounted) {
        setMarginAccounts(updatedMarginAccounts);
      }
    }
    if (address) {
      fetch(address);
    }
    return () => {
      mounted = false;
    };
    //TODO: temporary while we need metamask to fetch this info
  }, [address, marginAccountLensContract, provider]);

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
        {marginAccounts.map((marginAccount: MarginAccountPreview, index: number) => (
          <MarginAccountCard key={index} {...marginAccount} />
        ))}
      </MarginAccountsContainner>

      <CreateMarginAccountModal
        availablePools={[{ label: 'USDC/WETH 0.05%', value: '0xfBe57C73A82171A773D3328F1b563296151be515' }]}
        open={showConfirmModal}
        setOpen={setShowConfirmModal}
        onConfirm={(selectedPool: string | null) => {
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
      <CreatedMarginAccountModal open={showSuccessModal} setOpen={setShowSuccessModal} onConfirm={() => {
        navigate(0);
      }} />
      <FailedTxnModal open={showFailedModal} setOpen={setShowFailedModal} />
      <PendingTxnModal open={showSubmittingModal} setOpen={setShowSubmittingModal} />
    </AppPage>
  );
}
