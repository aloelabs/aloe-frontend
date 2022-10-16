import React from 'react';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { HorizontalDivider, MESSAGE_TEXT_COLOR } from '../../../common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { MODAL_BLACK_TEXT_COLOR } from '../../../common/Modal';
import SuccessIcon from '../../../../assets/svg/success.svg';
import { ConfirmationType, getConfirmationTypeValue } from '../EditPositionModal';

export type SuccessModalContentProps = {
  confirmationType: ConfirmationType;
  txnHash: string;
  onConfirm: () => void;
};

export default function SuccessModalContent(props: SuccessModalContentProps) {
  const { confirmationType, txnHash, onConfirm } = props;

  return (
    <div>
      <div className='flex justify-center items-center mb-4'>
        <img src={SuccessIcon} width={100} height={99} alt='success' />
      </div>
      <HorizontalDivider />
      <div className='mb-8'>
        <Text size='L' weight='bold' color={MESSAGE_TEXT_COLOR}>
          {getConfirmationTypeValue(confirmationType)} Successful
        </Text>
        <Text>
          <a
            href={`https://goerli.etherscan.io/tx/${txnHash}`}
            target='_blank'
            rel='noopener noreferrer'
            className='underline'
          >
            View on Etherscan
          </a>
        </Text>
      </div>
      <FilledStylizedButton size='M' fillWidth={true} color={MODAL_BLACK_TEXT_COLOR} onClick={onConfirm}>
        Okay
      </FilledStylizedButton>
    </div>
  );
}
