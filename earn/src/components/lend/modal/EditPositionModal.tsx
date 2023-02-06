import { Fragment, useEffect, useState } from 'react';

import { Tab } from '@headlessui/react';
import { SendTransactionResult } from '@wagmi/core';
import { useNavigate } from 'react-router-dom';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import tw from 'twin.macro';

import { Kitty } from '../../../data/Kitty';
import { Token } from '../../../data/Token';
import DepositModalContent from './content/DepositModalContent';
import FailureModalContent from './content/FailureModalContent';
import SuccessModalContent from './content/SuccessModalContent';
import WithdrawModalContent from './content/WithdrawModalContent';
import PendingTxnModal from './PendingTxnModal';

export enum ConfirmationType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
}

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
  token: Token;
  kitty: Kitty;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

export default function EditPositionModal(props: EditPositionModalProps) {
  const { token, kitty, isOpen, setIsOpen } = props;
  const [state, setState] = useState(EditPositionModalState.EDIT_POSITION);
  const [confirmationType, setConfirmationType] = useState<ConfirmationType>(ConfirmationType.DEPOSIT);
  const [pendingTxnResult, setPendingTxnResult] = useState<SendTransactionResult | null>(null);
  const [lastTxnHash, setLastTxnHash] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    if (pendingTxnResult?.hash) {
      setState(EditPositionModalState.LOADING);
      // Wait for txn to finish
      pendingTxnResult
        .wait(1)
        .then((txnResult) => {
          if (mounted) {
            // Check if txn was successful
            if (txnResult.status === 1) {
              setLastTxnHash(pendingTxnResult.hash);
              setState(EditPositionModalState.SUCCESS);
              setPendingTxnResult(null);
            } else {
              setState(EditPositionModalState.FAILURE);
              setPendingTxnResult(null);
            }
          }
        })
        .catch((error) => {
          if (mounted) {
            setState(EditPositionModalState.FAILURE);
            setPendingTxnResult(null);
          }
        });
    }
    return () => {
      mounted = false;
    };
  }, [pendingTxnResult]);

  function clearState() {
    setIsOpen(false);
    /* Timeout used to take transition into account */
    setTimeout(() => {
      setConfirmationType(ConfirmationType.DEPOSIT);
      setPendingTxnResult(null);
      setState(EditPositionModalState.EDIT_POSITION);
    }, 500);
  }

  return (
    <>
      {state !== EditPositionModalState.LOADING && (
        <Modal
          isOpen={isOpen}
          setIsOpen={(open) => {
            if (!open) {
              if (state === EditPositionModalState.SUCCESS) {
                // If the transaction was successful, refresh the page to load updated data
                navigate(0);
              } else {
                // Otherwise, just clear the state
                clearState();
              }
            }
          }}
          title={ConfirmationType.DEPOSIT === confirmationType ? 'Deposit' : 'Withdraw'}
        >
          {state === EditPositionModalState.EDIT_POSITION && (
            <Tab.Group>
              <Tab.List className='w-full flex rounded-md mb-6'>
                <TabsWrapper>
                  {Object.keys(ConfirmationType).map((type: string, index: number) => (
                    <Tab as={Fragment} key={index}>
                      {({ selected }) => (
                        <TabButton
                          className={selected ? 'selected' : ''}
                          onClick={() => setConfirmationType(type as ConfirmationType)}
                        >
                          <Text size='M' weight='bold' color='rgb(255, 255, 255)'>
                            {getConfirmationTypeValue(type as ConfirmationType)}
                          </Text>
                        </TabButton>
                      )}
                    </Tab>
                  ))}
                </TabsWrapper>
              </Tab.List>
              <Tab.Panels as={Fragment}>
                <Tab.Panel className='w-full px-2'>
                  <DepositModalContent token={token} kitty={kitty} setPendingTxnResult={setPendingTxnResult} />
                </Tab.Panel>
                <Tab.Panel className='w-full px-2'>
                  <WithdrawModalContent token={token} kitty={kitty} setPendingTxnResult={setPendingTxnResult} />
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
          )}
          {state === EditPositionModalState.SUCCESS && (
            <SuccessModalContent
              confirmationType={confirmationType}
              txnHash={lastTxnHash || ''}
              onConfirm={() => {
                // Since we are refreshing the page, we do not need to clear the state
                navigate(0);
              }}
            />
          )}
          {state === EditPositionModalState.FAILURE && (
            <FailureModalContent
              confirmationType={confirmationType}
              onConfirm={() => {
                clearState();
              }}
              txnHash={pendingTxnResult?.hash || ''}
            />
          )}
        </Modal>
      )}
      {state === EditPositionModalState.LOADING && (
        <PendingTxnModal isOpen={isOpen} setIsOpen={setIsOpen} txnHash={pendingTxnResult?.hash} />
      )}
    </>
  );
}
