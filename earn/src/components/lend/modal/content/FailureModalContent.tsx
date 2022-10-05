import React from 'react';
import { FilledGreyButton } from '../../../common/Buttons';
import { MESSAGE_TEXT_COLOR } from '../../../common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import ErrorIcon from '../../../../assets/svg/error.svg';

export type FailureModalContentProps = {
  onConfirm: () => void;
};

export default function FailureModalContent(props: FailureModalContentProps) {
  const { onConfirm } = props;

  return (
    <div>
      <div className='flex justify-center items-center mb-4'>
        <img src={ErrorIcon} width={40} height={40} alt='error' />
      </div>
      <div className='flex justify-between items-center mb-8 max-w-sm'>
        <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR}>
          Oops! Something went wrong with your transaction, please try again later.
        </Text>
      </div>
      <FilledGreyButton size='M' fillWidth={true} onClick={onConfirm}>
        Dismiss
      </FilledGreyButton>
    </div>
  );
}
