import React from 'react';
import {
  LoadingModal, MESSAGE_TEXT_COLOR,
} from '../../common/Modal';
import { Text } from 'shared/lib/components/common/Typography';

export type PendingTxnModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  txnHash?: string;
};

export default function PendingTxnModal(props: PendingTxnModalProps) {
  return (
    <LoadingModal
      open={props.open}
      setOpen={props.setOpen}
      title='Submitting Order'
    >
      <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR}>
        This might take a while. Feel free to leave the page and come back later.
      </Text>
      {props.txnHash &&
      <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR}>
        <a
          href={`https://goerli.etherscan.io/tx/${props.txnHash}`}
          target='_blank'
          rel='noopener noreferrer'
          className='underline'
        >
          View on Etherscan
        </a>
      </Text>
      }
    </LoadingModal>
  );
}
