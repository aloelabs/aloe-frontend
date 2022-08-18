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
import ConfirmModalContent, { ConfirmationType } from './content/ConfirmModalContent';
import FailureModalContent from './content/FailureModalContent';
import LoadingModalContent from './content/LoadingModalContent';
import SuccessModalContent from './content/SuccessModalContent';

enum AddPositionModalState {
  ADD_POSITION = 'ADD_POSITION',
  CONFIRM_ADD_POSITION = 'CONFIRM_ADD_POSITION',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export type AddPositionModalProps = {
  token: TokenData;
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function AddPositionModal(props: AddPositionModalProps) {
  const { token, open, setOpen, onConfirm, onCancel } = props;

  const pricePerToken = 1;
  const [state, setState] = React.useState(AddPositionModalState.ADD_POSITION);
  const [depositAmount, setDepositAmount] = React.useState<string>('');
  
  function clearState() {
    setState(AddPositionModalState.ADD_POSITION);
    setDepositAmount('');
  }

  function getTitleFromState(state: AddPositionModalState) {
    switch (state) {
      case AddPositionModalState.ADD_POSITION:
        return 'Add Position';
      case AddPositionModalState.CONFIRM_ADD_POSITION:
        return `Confirm Deposit`;
      case AddPositionModalState.LOADING:
        return 'Loading';
      case AddPositionModalState.SUCCESS:
        return `Deposit Successful`;
      case AddPositionModalState.FAILURE:
        return 'Transaction Failed';
      default:
        return '';
    }
  }

  return (
    <CloseableModal
      open={open}
      setOpen={setOpen}
      onClose={onCancel}
      title={getTitleFromState(state)}
    >
      {state === AddPositionModalState.ADD_POSITION && (
        <>
          <div className='mb-4'>
            <TokenAmountInput
              onChange={(updatedAmount: string) => {
                setDepositAmount(updatedAmount);
              }}
              value={depositAmount}
              tokenLabel={token?.ticker || ''}
              max={'10'}
              maxed={depositAmount === '10'}
            />
          </div>
          <div className='flex justify-between items-center mb-8'>
            <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
              Estimated Value
            </Text>
            <DashedDivider />
            <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
              {formatUSDAuto(pricePerToken * parseFloat(depositAmount) || 0)}
            </Text>
          </div>
          <FilledStylizedButton
            size='M'
            fillWidth={true}
            color={MODAL_BLACK_TEXT_COLOR}
            onClick={() => {
              setState(AddPositionModalState.CONFIRM_ADD_POSITION);
            }}
          >
            Confirm Deposit
          </FilledStylizedButton>
        </>
      )}
      {state === AddPositionModalState.CONFIRM_ADD_POSITION && (
        <ConfirmModalContent
          confirmationType={ConfirmationType.DEPOSIT}
          token={token}
          tokenAmount={depositAmount}
          onConfirm={() => {
            setState(AddPositionModalState.LOADING);
            setTimeout(() => {
              setState(AddPositionModalState.SUCCESS);
            }, 5000);
          }}
        />
      )}
      {state === AddPositionModalState.LOADING && (
        <LoadingModalContent />
      )}
      {state === AddPositionModalState.SUCCESS && (
        <SuccessModalContent
          confirmationType={ConfirmationType.DEPOSIT}
          token={token}
          tokenAmount={depositAmount}
          onConfirm={() => {
            onConfirm();
            setTimeout(() => {
              clearState();
            }, 500);
          }}
        />
      )}
      {state === AddPositionModalState.FAILURE && (
        <FailureModalContent
          onConfirm={() => {
            onCancel();
            clearState();
          }}
        />
      )}
    </CloseableModal>
  );
}
