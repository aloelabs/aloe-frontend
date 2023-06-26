import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { CloseableModal, HorizontalDivider, MODAL_BLACK_TEXT_COLOR } from 'shared/lib/components/common/Modal';

import SuccessIcon from '../../../assets/svg/success.svg';
import FeedbackBlock from './common/FeedbackBlock';

export type SuccessfulTxnModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
};

export default function SuccessfulTxnModal(props: SuccessfulTxnModalProps) {
  const { open, setOpen, onConfirm } = props;
  return (
    <CloseableModal isOpen={open} setIsOpen={setOpen} onClose={onConfirm} title='Transaction Successful'>
      <div className='flex justify-center items-center mb-2'>
        <img src={SuccessIcon} alt='success' />
      </div>
      <FeedbackBlock />
      <HorizontalDivider />
      <FilledStylizedButton
        size='M'
        fillWidth={true}
        color={MODAL_BLACK_TEXT_COLOR}
        className='mt-8'
        onClick={() => {
          setOpen(false);
          onConfirm();
        }}
      >
        Okay!
      </FilledStylizedButton>
    </CloseableModal>
  );
}
