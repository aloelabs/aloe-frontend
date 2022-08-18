import React from 'react';
import { TokenData } from '../../../../data/TokenData';
import { formatUSDAuto } from '../../../../util/Numbers';
import { FilledStylizedButton } from '../../../common/Buttons';
import {
  DashedDivider,
  LABEL_TEXT_COLOR,
  MESSAGE_TEXT_COLOR,
  VALUE_TEXT_COLOR,
} from '../../../common/Modal';
import { Text } from '../../../common/Typography';
import { MODAL_BLACK_TEXT_COLOR } from '../../../pool/PoolInteractionTabs';
import SuccessIcon from '../../../../assets/svg/success.svg';
import { ConfirmationType, getConfirmationTypeValue } from './ConfirmModalContent';

export type SuccessModalContentProps = {
  confirmationType: ConfirmationType;
  token: TokenData;
  tokenAmount: string;
  onConfirm: () => void;
};

export default function SuccessModalContent(props: SuccessModalContentProps) {
  const {
    confirmationType,
    token,
    tokenAmount,
    onConfirm,
  } = props;

  return (
    <div>
      <div className='flex justify-center items-center mb-4'>
        <img src={SuccessIcon} width={100} height={99} alt='success' />
      </div>
      <div className='mb-4'>
        <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR}>
          {getConfirmationTypeValue(confirmationType)} Summary:
        </Text>
      </div>
      <div className='flex justify-between items-center mb-4'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
          {getConfirmationTypeValue(confirmationType)} Amount
        </Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
          {/* TODO: calculate the actual estimated value */}
          {tokenAmount || 0} {token?.ticker || ''}
        </Text>
      </div>
      <div className='flex justify-between items-center mb-8'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
          Estimated Value
        </Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
          {/* TODO: calculate the actual estimated value */}
          {formatUSDAuto(parseFloat(tokenAmount) || 0)}
        </Text>
      </div>
      <FilledStylizedButton
        size='M'
        fillWidth={true}
        color={MODAL_BLACK_TEXT_COLOR}
        onClick={onConfirm}
      >
        Okay
      </FilledStylizedButton>
    </div>
  );
}
