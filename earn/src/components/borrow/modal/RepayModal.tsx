import { SendTransactionResult } from '@wagmi/core';
import Modal from 'shared/lib/components/common/Modal';
import { useAccount } from 'wagmi';

export type RepayModalProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function RepayModal(props: RepayModalProps) {
  const { isOpen, setIsOpen } = props;

  const { address: userAddress } = useAccount();

  const resetModal = () => {};

  if (!userAddress || !isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      title='Repay'
      setIsOpen={(open: boolean) => {
        setIsOpen(open);
        if (!open) {
          resetModal();
        }
      }}
      maxHeight='650px'
    >
      <div className='w-full'></div>
    </Modal>
  );
}
