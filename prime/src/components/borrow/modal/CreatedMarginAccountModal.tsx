import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';

import SuccessIcon from '../../../assets/svg/success.svg';
import { CloseableModal, HorizontalDivider } from '../../common/Modal';
import { MODAL_BLACK_TEXT_COLOR } from '../../common/Modal';

export type CreatedMarginAccountModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
};

export default function CreatedMarginAccountModal(props: CreatedMarginAccountModalProps) {
  const { open, setOpen, onConfirm } = props;
  return (
    <CloseableModal open={open} setOpen={setOpen} title='Account Created'>
      <div className='flex justify-center items-center'>
        <img src={SuccessIcon} alt='success' />
      </div>
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
        Sweet!
      </FilledStylizedButton>
    </CloseableModal>
  );
}
