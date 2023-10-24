import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal, { LABEL_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import { MODAL_BLACK_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';

import SuccessIcon from '../../../assets/svg/success.svg';

export type CreatedMarginAccountModalProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onConfirm: () => void;
};

export default function CreatedMarginAccountModal(props: CreatedMarginAccountModalProps) {
  const { isOpen, setIsOpen, onConfirm } = props;
  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Account Created'>
      <div className='flex justify-center items-center'>
        <img src={SuccessIcon} alt='success' />
      </div>
      <div className='w-full mt-4'>
        <Text size='M' weight='bold' color={LABEL_TEXT_COLOR} className='text-center'>
          Your Borrow Vault has been created and will be available momentarily.
        </Text>
      </div>
      <FilledStylizedButton
        size='M'
        fillWidth={true}
        color={MODAL_BLACK_TEXT_COLOR}
        className='mt-8'
        onClick={() => {
          setIsOpen(false);
          onConfirm();
        }}
      >
        Sweet!
      </FilledStylizedButton>
    </Modal>
  );
}
