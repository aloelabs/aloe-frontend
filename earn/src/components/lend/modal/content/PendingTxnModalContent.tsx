import React from 'react';
import { MESSAGE_TEXT_COLOR } from '../../../common/Modal';
import { Text } from 'shared/lib/components/common/Typography';

export type PendingTxnModalContentProps = {
  txnHash?: string;
};

export default function PendingTxnModalContent(props: PendingTxnModalContentProps) {
  return (
    <div className='mt-4'>
      <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR}>
        This might take a while. Feel free to leave the page and come back
        later.
      </Text>
      {props.txnHash && (
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
      )}
    </div>
  );
}
