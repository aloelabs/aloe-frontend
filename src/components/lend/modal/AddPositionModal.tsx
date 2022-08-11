import React from 'react';
import { TokenData } from '../../../data/TokenData';
import { formatUSDAuto } from '../../../util/Numbers';
import { FilledStylizedButton } from '../../common/Buttons';
import {
  CloseableModal,
  DashedDivider,
  LABEL_TEXT_COLOR,
  VALUE_TEXT_COLOR,
} from '../../common/Modal';
import TokenAmountInput from '../../common/TokenAmountInput';
import { Text } from '../../common/Typography';
import { MODAL_BLACK_TEXT_COLOR } from '../../pool/PoolInteractionTabs';

export type AddPositionModalProps = {
  token: TokenData;
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function AddPositionModal(props: AddPositionModalProps) {
  const {
    token,
    open,
    setOpen,
    onConfirm,
    onCancel,
  } = props;

  const [amount, setAmount] = React.useState('');
  const pricePerToken = 1;

  return (
    <CloseableModal
      open={open}
      setOpen={setOpen}
      onClose={onCancel}
      title='Add Position'
    >
      <div className='mb-4'>
        <TokenAmountInput
          onChange={(updatedAmount: string) => {
            setAmount(updatedAmount);
          }}
          value={amount}
          tokenLabel={token?.ticker || ''}
          max={'10'}
          maxed={amount === '10'}
        />
      </div>
      <div className='flex justify-between items-center mb-8'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
          Estimated Value
        </Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
          {formatUSDAuto(pricePerToken * parseFloat(amount) || 0)}
        </Text>
      </div>
      <FilledStylizedButton
        size='M'
        fillWidth={true}
        color={MODAL_BLACK_TEXT_COLOR}
        onClick={onConfirm}
      >
        Confirm Deposit
      </FilledStylizedButton>
    </CloseableModal>
  );
}
