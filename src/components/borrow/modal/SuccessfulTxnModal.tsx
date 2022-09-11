import React from 'react';
import SuccessIcon from '../../../assets/svg/success.svg';
import { FilledStylizedButton } from '../../common/Buttons';
import {
  CloseableModal,
  HorizontalDivider,
} from '../../common/Modal';
import { MODAL_BLACK_TEXT_COLOR } from '../../pool/PoolInteractionTabs';

export type SuccessfulTxnModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
};

export default function SuccessfulTxnModal(props: SuccessfulTxnModalProps) {
  const {
    open,
    setOpen,
    onConfirm,
  } = props;
  return (
    <CloseableModal open={open} setOpen={setOpen} title='Transaction Successful'>
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
        Okay!
      </FilledStylizedButton>
    </CloseableModal>
  );
}
