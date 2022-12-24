import React from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import { DEFAULT_ETHERSCAN_URL } from 'shared/lib/data/constants/Values';
import { Chain } from 'wagmi';

import { MESSAGE_TEXT_COLOR } from '../../../common/Modal';

export type PendingTxnModalContentProps = {
  activeChain: Chain;
  txnHash?: string;
};

export default function PendingTxnModalContent(props: PendingTxnModalContentProps) {
  const { activeChain, txnHash } = props;
  const etherscanUrl = activeChain.blockExplorers?.etherscan?.url ?? DEFAULT_ETHERSCAN_URL;
  return (
    <div className='mt-4'>
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
    </div>
  );
}
