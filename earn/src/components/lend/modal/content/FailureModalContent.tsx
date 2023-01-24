import React, { useContext } from 'react';

import { FilledGreyButton } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';
import { ChainContext } from '../../../../App';

import ErrorIcon from '../../../../assets/svg/error.svg';
import { MESSAGE_TEXT_COLOR } from '../../../common/Modal';
import { ConfirmationType, getConfirmationTypeValue } from '../EditPositionModal';

export type FailureModalContentProps = {
  confirmationType: ConfirmationType;
  txnHash: string;
  onConfirm: () => void;
};

export default function FailureModalContent(props: FailureModalContentProps) {
  const { confirmationType, txnHash, onConfirm } = props;
  const { activeChain } = useContext(ChainContext);

  return (
    <div className='w-full'>
      <div className='flex justify-center items-center mb-4'>
        <img src={ErrorIcon} width={40} height={40} alt='error' />
      </div>
      <div className='mb-8'>
        <Text size='L' weight='bold' color={MESSAGE_TEXT_COLOR}>
          {getConfirmationTypeValue(confirmationType)} Failed
        </Text>
        <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR} className='mb-4'>
          Oops! Something went wrong with your transaction, please try again later.
        </Text>
        <Text>
          <a
            href={`${getEtherscanUrlForChain(activeChain)}/tx/${txnHash}`}
            target='_blank'
            rel='noopener noreferrer'
            className='underline'
          >
            View on Etherscan
          </a>
        </Text>
      </div>
      <FilledGreyButton size='M' fillWidth={true} onClick={onConfirm}>
        Dismiss
      </FilledGreyButton>
    </div>
  );
}
