import React from 'react';

import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import { DEFAULT_ETHERSCAN_URL } from 'shared/lib/data/constants/Values';
import { Chain } from 'wagmi';

import SuccessIcon from '../../../../assets/svg/success.svg';
import { HorizontalDivider, MESSAGE_TEXT_COLOR } from '../../../common/Modal';
import { MODAL_BLACK_TEXT_COLOR } from '../../../common/Modal';
import { ConfirmationType, getConfirmationTypeValue } from '../EditPositionModal';

export type SuccessModalContentProps = {
  activeChain: Chain;
  confirmationType: ConfirmationType;
  txnHash: string;
  onConfirm: () => void;
};

export default function SuccessModalContent(props: SuccessModalContentProps) {
  const { activeChain, confirmationType, txnHash, onConfirm } = props;
  const etherscanUrl = activeChain.blockExplorers?.etherscan?.url ?? DEFAULT_ETHERSCAN_URL;

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
          <a href={`${etherscanUrl}/tx/${txnHash}`} target='_blank' rel='noopener noreferrer' className='underline'>
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
