import React from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import { DEFAULT_ETHERSCAN_URL } from 'shared/lib/data/constants/Values';
import { Chain } from 'wagmi';

import { LoadingModal, MESSAGE_TEXT_COLOR } from '../../common/Modal';

export type PendingTxnModalProps = {
  activeChain: Chain;
  txnHash?: string;
  open: boolean;
  setOpen: (open: boolean) => void;
};

export default function PendingTxnModal(props: PendingTxnModalProps) {
  const { activeChain, txnHash, open, setOpen } = props;
  const etherscanUrl = activeChain.blockExplorers?.etherscan?.url ?? DEFAULT_ETHERSCAN_URL;
  return (
    <LoadingModal open={open} setOpen={setOpen} title='Submitting Order'>
      <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR}>
        This might take a while. Feel free to leave the page and come back later.
      </Text>
      {txnHash && (
        <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR}>
          <a href={`${etherscanUrl}/tx/${txnHash}`} target='_blank' rel='noopener noreferrer' className='underline'>
            View on Etherscan
          </a>
        </Text>
      )}
    </LoadingModal>
  );
}
