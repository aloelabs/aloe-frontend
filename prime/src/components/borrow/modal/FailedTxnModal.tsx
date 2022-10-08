import React from 'react';
import { FilledGreyButton } from 'shared/lib/components/common/Buttons';
import { CloseableModal, MESSAGE_TEXT_COLOR } from '../../common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import FeedbackBlock from './common/FeedbackBlock';

const FAILED_BORDER_GRADIENT = 'rgba(235, 87, 87, 1)';

export type FailedTxnModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export default function FailedTxnModal(props: FailedTxnModalProps) {
  return (
    <CloseableModal
      open={props.open}
      setOpen={props.setOpen}
      title='Transaction Failed'
      borderGradient={FAILED_BORDER_GRADIENT}
    >
      <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR}>
        Oops! Something went wrong with your transaction. Try increasing the gas limit, and if that doesn't work, reach
        out on Discord.
      </Text>
      <FeedbackBlock />
      <FilledGreyButton
        size='M'
        fillWidth={true}
        className='mt-8'
        onClick={() => {
          props.setOpen(false);
        }}
      >
        Dismiss
      </FilledGreyButton>
    </CloseableModal>
  );
}
