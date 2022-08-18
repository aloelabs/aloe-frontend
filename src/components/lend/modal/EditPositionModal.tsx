import { Tab } from '@headlessui/react';
import React, { Fragment } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
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
import ConfirmModalContent, {
  ConfirmationType,
  getConfirmationTypeValue,
} from './content/ConfirmModalContent';
import FailureModalContent from './content/FailureModalContent';
import LoadingModalContent from './content/LoadingModalContent';
import SuccessModalContent from './content/SuccessModalContent';

const TabsWrapper = styled.div`
  ${tw`w-full flex flex-row`}
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(26, 41, 52, 1);
`;

const TabButton = styled.button`
  ${tw`w-full`}
  padding: 8px;
  border-radius: 8px;
  background-color: transparent;
  &.selected {
    background-color: rgba(26, 41, 52);
  }
`;

enum EditPositionModalState {
  EDIT_POSITION = 'EDIT_POSITION',
  CONFIRM_EDIT_POSITION = 'CONFIRM_EDIT_POSITION',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export type EditPositionModalProps = {
  token: TokenData;
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function EditPositionModal(props: EditPositionModalProps) {
  const { token, open, setOpen, onConfirm, onCancel } = props;
  const maxDeposit = '975';
  const maxWithdraw = '423';
  const [state, setState] = React.useState(
    EditPositionModalState.EDIT_POSITION
  );
  const [depositAmount, setDepositAmount] = React.useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = React.useState<string>('');
  const [confirmationType, setConfirmationType] =
    React.useState<ConfirmationType>(ConfirmationType.DEPOSIT);

  function clearState() {
    /* Timeout used to take transition into account */
    setTimeout(() => {
      setConfirmationType(ConfirmationType.DEPOSIT);
      setDepositAmount('');
      setWithdrawAmount('');
      setState(EditPositionModalState.EDIT_POSITION);
    }, 500);
  }

  function getTitleFromState(state: EditPositionModalState) {
    switch (state) {
      case EditPositionModalState.EDIT_POSITION:
        return 'Edit Position';
      case EditPositionModalState.CONFIRM_EDIT_POSITION:
        return `Confirm ${getConfirmationTypeValue(confirmationType)}`;
      case EditPositionModalState.LOADING:
        return 'Loading';
      case EditPositionModalState.SUCCESS:
        return `${getConfirmationTypeValue(confirmationType)} Successful`;
      case EditPositionModalState.FAILURE:
        return 'Transaction Failed';
      default:
        return '';
    }
  }

  return (
    <CloseableModal
      open={open}
      setOpen={setOpen}
      onClose={() => {
        onCancel();
        clearState();
      }}
      title={getTitleFromState(state)}
    >
      {state === EditPositionModalState.EDIT_POSITION && (
        <Tab.Group>
          <Tab.List className='flex rounded-md mb-6'>
            <TabsWrapper>
              {Object.keys(ConfirmationType).map(
                (type: string, index: number) => (
                  <Tab as={Fragment} key={index}>
                    {({ selected }) => (
                      <TabButton
                        className={selected ? 'selected' : ''}
                        onClick={() =>
                          setConfirmationType(type as ConfirmationType)
                        }
                      >
                        <Text size='M' weight='bold' color='rgb(255, 255, 255)'>
                          {getConfirmationTypeValue(type as ConfirmationType)}
                        </Text>
                      </TabButton>
                    )}
                  </Tab>
                )
              )}
            </TabsWrapper>
          </Tab.List>
          <Tab.Panels as={Fragment}>
            <Tab.Panel>
              <div className='flex justify-between items-center mb-4'>
                <TokenAmountInput
                  tokenLabel={token?.ticker || ''}
                  onChange={(updatedAmount: string) => {
                    setDepositAmount(updatedAmount);
                  }}
                  value={depositAmount}
                  max={maxDeposit}
                  maxed={depositAmount === maxDeposit}
                />
              </div>
              <div className='flex justify-between items-center mb-8'>
                <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
                  Estimated Total
                </Text>
                <DashedDivider />
                <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
                  {formatUSDAuto(parseFloat(depositAmount) || 0)}
                </Text>
              </div>
              <FilledStylizedButton
                size='M'
                fillWidth={true}
                color={MODAL_BLACK_TEXT_COLOR}
                onClick={() => {
                  setState(EditPositionModalState.CONFIRM_EDIT_POSITION);
                }}
              >
                Deposit
              </FilledStylizedButton>
            </Tab.Panel>
            <Tab.Panel>
              <div className='flex justify-between items-center mb-4'>
                <TokenAmountInput
                  tokenLabel={token?.ticker || ''}
                  onChange={(updatedAmount: string) => {
                    setWithdrawAmount(updatedAmount);
                  }}
                  value={withdrawAmount}
                  max={maxWithdraw}
                  maxed={withdrawAmount === maxWithdraw}
                />
              </div>
              <div className='flex justify-between items-center mb-8'>
                <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
                  Estimated Total
                </Text>
                <DashedDivider />
                <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
                  {formatUSDAuto(parseFloat(withdrawAmount) || 0)}
                </Text>
              </div>
              <FilledStylizedButton
                size='M'
                fillWidth={true}
                color={MODAL_BLACK_TEXT_COLOR}
                onClick={() => {
                  setState(EditPositionModalState.CONFIRM_EDIT_POSITION);
                }}
              >
                Withdraw
              </FilledStylizedButton>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      )}
      {state === EditPositionModalState.CONFIRM_EDIT_POSITION && (
        <ConfirmModalContent
          confirmationType={confirmationType}
          token={token}
          tokenAmount={depositAmount}
          onConfirm={() => {
            // TODO: add logic to handle deposit/withdraw and properly set state
            setState(EditPositionModalState.LOADING);
            setTimeout(() => {
              setState(EditPositionModalState.SUCCESS);
            }, 5000);
          }}
        />
      )}
      {state === EditPositionModalState.SUCCESS && (
        <SuccessModalContent
          confirmationType={confirmationType}
          token={token}
          tokenAmount={withdrawAmount}
          onConfirm={() => {
            onConfirm();
            clearState();
          }}
        />
      )}
      {state === EditPositionModalState.FAILURE && (
        <FailureModalContent
          onConfirm={() => {
            onCancel();
            clearState();
          }}
        />
      )}
      {state === EditPositionModalState.LOADING && <LoadingModalContent />}
    </CloseableModal>
  );
}
