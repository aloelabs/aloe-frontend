import { type WriteContractReturnType } from '@wagmi/core';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { Q32, TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import useChain from 'shared/lib/data/hooks/UseChain';
import { useSimulateContract, useWriteContract } from 'wagmi';

import { BorrowerNftBorrower } from '../../../data/BorrowerNft';
import { LendingPair } from '../../../data/LendingPair';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  LOADING,
  READY,
  WAITING_FOR_USER,
  ERROR,
}

function getConfirmButton(state: ConfirmButtonState): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.LOADING:
      return { text: 'Loading...', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Waiting for signature', enabled: false };
    case ConfirmButtonState.ERROR:
    default:
      return { text: 'Contract error', enabled: false };
  }
}

type ClearWarningButtonProps = {
  borrower: BorrowerNftBorrower;
  etherToSend: GN;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: WriteContractReturnType | null) => void;
};

function ClearWarningButton(props: ClearWarningButtonProps) {
  const { borrower, etherToSend, setIsOpen, setPendingTxn } = props;
  const activeChain = useChain();

  const {
    data: clearConfig,
    isError: isUnableToClear,
    isLoading: isCheckingIfAbleToClear,
  } = useSimulateContract({
    address: borrower.address,
    abi: borrowerAbi,
    functionName: 'clear',
    args: [Q32],
    value: etherToSend.toBigInt(),
    chainId: activeChain.id,
  });
  const { writeContractAsync: clearWarning, isPending: isAskingUserToClearWarning } = useWriteContract();

  let confirmButtonState = ConfirmButtonState.READY;
  if (isCheckingIfAbleToClear) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (isUnableToClear) {
    confirmButtonState = ConfirmButtonState.ERROR;
  } else if (isAskingUserToClearWarning) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_USER;
  }

  const confirmButton = getConfirmButton(confirmButtonState);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      disabled={!confirmButton.enabled || !clearConfig}
      onClick={() =>
        clearWarning(clearConfig!.request)
          .then((hash) => {
            setIsOpen(false);
            setPendingTxn(hash);
          })
          .catch((e) => console.error(e))
      }
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type ClearWarningModalProps = {
  borrower: BorrowerNftBorrower;
  market: LendingPair;
  accountEtherBalance?: GN;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function ClearWarningModal(props: ClearWarningModalProps) {
  const { borrower, market, accountEtherBalance, isOpen, setIsOpen, setPendingTxn } = props;

  if (!isOpen) return null;

  const ante = market.factoryData.ante;
  let etherToSend = GN.zero(18, 10);
  if (accountEtherBalance !== undefined && accountEtherBalance.lt(ante)) {
    etherToSend = ante.sub(accountEtherBalance);
  }

  return (
    <Modal isOpen={isOpen} title='End Auction' setIsOpen={setIsOpen} maxHeight='650px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            Your account is healthy, and you're ending the liquidation auction by replenishing the ante with{' '}
            {etherToSend.toString(GNFormat.DECIMAL)} ETH. This is necessary to cover gas fees in the event that you are
            liquidated again.
          </Text>
        </div>
        <div className='w-full'>
          <ClearWarningButton
            borrower={borrower}
            etherToSend={etherToSend}
            setIsOpen={setIsOpen}
            setPendingTxn={setPendingTxn}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By using our service, you agree to our{' '}
            <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
              Terms of Service
            </a>{' '}
            and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It
            is your duty to educate yourself and be aware of the risks.
          </Text>
        </div>
      </div>
    </Modal>
  );
}
