import { useEffect, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import {
  chain,
  useAccount,
  useContract,
  useProvider,
  useSigner,
  useBlockNumber,
} from 'wagmi';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import { MarginAccountCard } from '../components/borrow/MarginAccountCard';
import CreatedMarginAccountModal from '../components/borrow/modal/CreatedMarginAccountModal';
import CreateMarginAccountModal from '../components/borrow/modal/CreateMarginAccountModal';
import FailedTxnModal from '../components/borrow/modal/FailedTxnModal';
import PendingTxnModal from '../components/borrow/modal/PendingTxnModal';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGradientButtonWithIcon } from '../components/common/Buttons';
import { Display } from 'shared/lib/components/common/Typography';
import { createMarginAccount } from '../connector/FactoryActions';
import {
  fetchMarginAccountPreviews,
  MarginAccountPreview,
} from '../data/MarginAccount';

import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import WelcomeModal from '../components/borrow/modal/WelcomeModal';
import useEffectOnce from '../data/hooks/UseEffectOnce';

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
  // --> other
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [marginAccounts, setMarginAccounts] = useState<MarginAccountPreview[]>(
    []
  );

  // MARK: wagmi hooks
  const currentChainId = chain.goerli.id;
  const provider = useProvider({ chainId: currentChainId });
  const { address } = useAccount();
  const { data: signer } = useSigner();
  const blockNumber = useBlockNumber({
    chainId: currentChainId,
    watch: true,
  });
  const marginAccountLensContract = useContract({
    addressOrName: '0x2CfDfC4817b0fAf09Fa1613108418D7Ba286725a',
    contractInterface: MarginAccountLensABI,
    signerOrProvider: provider,
  });

  useEffect(() => {
    let mounted = true;

    async function fetch(userAddress: string) {
      const updatedMarginAccounts = await fetchMarginAccountPreviews(
        marginAccountLensContract,
        provider,
        userAddress
      );
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
  }, [address, marginAccountLensContract, provider, blockNumber.data]);

  useEffectOnce(() => {
    const shouldShowWelcomeModal =
      localStorage.getItem('acknowledgedWelcomeModal') !== 'true';
    if (shouldShowWelcomeModal) {
      setShowWelcomeModal(true);
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
          disabled={address === undefined}
        >
          New
        </FilledGradientButtonWithIcon>
      </div>
      <MarginAccountsContainner>
        {marginAccounts.map(
          (marginAccount: MarginAccountPreview, index: number) => (
            <MarginAccountCard key={index} {...marginAccount} />
          )
        )}
      </MarginAccountsContainner>

      <CreateMarginAccountModal
        availablePools={[
          {
            label: 'USDC/WETH 0.05%',
            value: '0xfBe57C73A82171A773D3328F1b563296151be515',
          },
        ]}
        open={showConfirmModal}
        setOpen={setShowConfirmModal}
        onConfirm={(selectedPool: string | null) => {
          setShowConfirmModal(false);
          setTimeout(() => {
            setShowSubmittingModal(true);
          }, 500);
          if (!signer || !address || !selectedPool) {
            // TODO
            return;
          }
          createMarginAccount(signer, selectedPool, address, (receipt) => {
            setShowSubmittingModal(false);
            if (receipt?.status === 1) {
              setTimeout(() => {
                setShowSuccessModal(true);
              }, 500);
            } else {
              setTimeout(() => {
                setShowFailedModal(true);
              }, 500);
            }
            console.log(receipt);
          });
        }}
        onCancel={() => {
          // TODO
        }}
      />
      <CreatedMarginAccountModal
        open={showSuccessModal}
        setOpen={setShowSuccessModal}
        onConfirm={() => {
          setShowSuccessModal(false);
        }}
      />
      <FailedTxnModal open={showFailedModal} setOpen={setShowFailedModal} />
      <PendingTxnModal
        open={showSubmittingModal}
        setOpen={setShowSubmittingModal}
      />
      <WelcomeModal
        open={showWelcomeModal}
        setOpen={setShowWelcomeModal}
        onConfirm={() => {
          localStorage.setItem('acknowledgedWelcomeModal', 'true');
        }}
      />
    </AppPage>
  );
}
