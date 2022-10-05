import React from 'react';
import SuccessIcon from '../../../assets/svg/success.svg';
import { FilledStylizedButton } from '../../common/Buttons';
import {
  CloseableModal,
  DashedDivider,
  HorizontalDivider,
  LABEL_TEXT_COLOR,
  MESSAGE_TEXT_COLOR,
  VALUE_TEXT_COLOR,
} from '../../common/Modal';
import TokenBreakdown from 'shared/lib/components/common/TokenBreakdown';
import { Text } from 'shared/lib/components/common/Typography';
import { MODAL_BLACK_TEXT_COLOR } from '../../common/Modal';

export type CreatedMarginAccountModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
};

export default function CreatedMarginAccountModal(props: CreatedMarginAccountModalProps) {
  const {
    open,
    setOpen,
    onConfirm,
  } = props;
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
