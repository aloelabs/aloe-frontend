import { SendTransactionResult } from '@wagmi/core';
import Modal from 'shared/lib/components/common/Modal';
import { useAccount } from 'wagmi';

export type BorrowModalProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function BorrowModal(props: BorrowModalProps) {
  const { isOpen, setIsOpen } = props;

  const { address: userAddress } = useAccount();

  const resetModal = () => {};

  if (!userAddress || !isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      title='Borrow'
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
