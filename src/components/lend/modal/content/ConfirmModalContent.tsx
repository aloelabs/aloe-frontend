import React from 'react';
import { TokenData } from '../../../../data/TokenData';
import { formatUSDAuto } from '../../../../util/Numbers';
import { FilledStylizedButton } from '../../../common/Buttons';
import {
  DashedDivider,
  LABEL_TEXT_COLOR,
  VALUE_TEXT_COLOR,
} from '../../../common/Modal';
import { Text } from '../../../common/Typography';
import { MODAL_BLACK_TEXT_COLOR } from '../../../pool/PoolInteractionTabs';

export enum ConfirmationType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
};

export function getConfirmationTypeValue(type: ConfirmationType): string {
  switch (type) {
    case ConfirmationType.DEPOSIT:
      return 'Deposit';
    case ConfirmationType.WITHDRAW:
      return 'Withdraw';
    default:
      return '';
  }
}

export type ConfirmModalContentProps = {
  confirmationType: ConfirmationType;
  token: TokenData;
  tokenAmount: string;
  onConfirm: () => void;
};

export default function ConfirmModalContent(props: ConfirmModalContentProps) {
  const {
    confirmationType,
    token,
    tokenAmount,
    onConfirm,
  } = props;

  return (
    <div>
      <div className='flex justify-between items-center mb-4'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
          {getConfirmationTypeValue(confirmationType)} Amount
        </Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
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
        Confirm {getConfirmationTypeValue(confirmationType)}
      </FilledStylizedButton>
    </div>
  );
}
