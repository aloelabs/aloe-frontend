import { useContext, useEffect, useState } from 'react';

import { ContractReceipt } from 'ethers';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGradientButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { DropdownOption } from 'shared/lib/components/common/Dropdown';
import { AltSpinner } from 'shared/lib/components/common/Spinner';
import { Display } from 'shared/lib/components/common/Typography';
import { useAccount, useContract, useProvider, useSigner, useBlockNumber } from 'wagmi';

import { ChainContext, useGeoFencing } from '../App';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import ActiveMarginAccounts from '../components/borrow/ActiveMarginAccounts';
import CreatedMarginAccountModal from '../components/borrow/modal/CreatedMarginAccountModal';
import CreateMarginAccountModal from '../components/borrow/modal/CreateMarginAccountModal';
import FailedTxnModal from '../components/borrow/modal/FailedTxnModal';
import PendingTxnModal from '../components/borrow/modal/PendingTxnModal';
import { createBorrower } from '../connector/FactoryActions';
import { ALOE_II_BORROWER_LENS_ADDRESS } from '../data/constants/Addresses';
import { fetchMarginAccountPreviews, MarginAccountPreview } from '../data/MarginAccount';

const MARGIN_ACCOUNT_OPTIONS: DropdownOption<string>[] = [
  {
    label: 'USDC/WETH 0.05%',
    value: '0xfBe57C73A82171A773D3328F1b563296151be515',
  },
  {
    label: 'WBTC/WETH 0.3%',
    value: '0xc0A1c271efD6D6325D5db33db5e7cF42A715CD12',
  },
];

export default function BorrowAccountsPage() {
  const { activeChain } = useContext(ChainContext);
  const isAllowedToInteract = useGeoFencing(activeChain);
  // MARK: component state
  // --> transaction modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [showSubmittingModal, setShowSubmittingModal] = useState(false);
  // --> other
  const [marginAccounts, setMarginAccounts] = useState<MarginAccountPreview[]>([]);
  const [isLoadingMarginAccounts, setIsLoadingMarginAccounts] = useState(true);
  const [isTxnPending, setIsTxnPending] = useState(false);

  // MARK: wagmi hooks
  const provider = useProvider({ chainId: activeChain.id });
  const { address } = useAccount();
  const { data: signer } = useSigner();

  // MARK: block number
  const blockNumber = useBlockNumber({
    chainId: activeChain.id,
    watch: true,
    // Keep this at 13 seconds for consistency between networks
    staleTime: 13_000,
  });

  const borrowerLensContract = useContract({
    address: ALOE_II_BORROWER_LENS_ADDRESS,
    abi: MarginAccountLensABI,
    signerOrProvider: provider,
  });

  useEffect(() => {
    let mounted = true;

    async function fetch(userAddress: string) {
      // Guard clause: if the margin account lens contract is null, don't fetch
      if (!borrowerLensContract || !isAllowedToInteract) {
        setMarginAccounts([]);
        return;
      }
      try {
        const updatedMarginAccounts = await fetchMarginAccountPreviews(
          activeChain,
          borrowerLensContract,
          provider,
          userAddress
        );
        if (mounted) {
          setMarginAccounts(updatedMarginAccounts);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) {
          setIsLoadingMarginAccounts(false);
        }
      }
    }
    if (address) {
      fetch(address);
    } else {
      setIsLoadingMarginAccounts(false);
    }
    return () => {
      mounted = false;
    };
  }, [activeChain, address, isAllowedToInteract, borrowerLensContract, provider, blockNumber.data]);

  function onCommencement() {
    setIsTxnPending(false);
    setShowConfirmModal(false);
    setTimeout(() => {
      setShowSubmittingModal(true);
    }, 500);
  }

  function onCompletion(receipt?: ContractReceipt) {
    // Reset state (close out of potentially open modals)
    if (receipt === undefined) {
      setIsTxnPending(false);
      return;
    }
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
  }

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
          disabled={address === undefined || !isAllowedToInteract}
        >
          New
        </FilledGradientButtonWithIcon>
      </div>
      <div className='flex items-center justify-start flex-wrap gap-4'>
        {isLoadingMarginAccounts ? (
          <div className='flex items-center justify-center w-full'>
            <AltSpinner size='M' />
          </div>
        ) : (
          <ActiveMarginAccounts marginAccounts={marginAccounts} />
        )}
      </div>
      <CreateMarginAccountModal
        availablePools={MARGIN_ACCOUNT_OPTIONS}
        isOpen={showConfirmModal}
        isTxnPending={isTxnPending}
        setIsOpen={setShowConfirmModal}
        onConfirm={(selectedPool: string | null) => {
          setIsTxnPending(true);
          if (!signer || !address || !selectedPool || !isAllowedToInteract) {
            return;
          }
          createBorrower(signer, selectedPool, address, onCommencement, onCompletion);
        }}
      />
      <CreatedMarginAccountModal
        isOpen={showSuccessModal}
        setIsOpen={setShowSuccessModal}
        onConfirm={() => {
          setShowSuccessModal(false);
        }}
      />
      <FailedTxnModal open={showFailedModal} setOpen={setShowFailedModal} />
      <PendingTxnModal open={showSubmittingModal} setOpen={setShowSubmittingModal} />
    </AppPage>
  );
}
