import React, { useContext } from 'react';

import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import Modal, { LoadingModal, MESSAGE_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';

import { ChainContext } from '../../App';
import { ReactComponent as ErrorIcon } from '../../assets/svg/error.svg';
import { ReactComponent as SuccessIcon } from '../../assets/svg/success.svg';

export enum PendingTxnModalStatus {
  PENDING,
  SUCCESS,
  FAILURE,
}

const STATUS_TITLES = {
  [PendingTxnModalStatus.PENDING]: 'Submitting Order',
  [PendingTxnModalStatus.SUCCESS]: 'Transaction Successful',
  [PendingTxnModalStatus.FAILURE]: 'Transaction Failed',
};

function EtherscanLink(props: { txnHash: string }) {
  const { activeChain } = useContext(ChainContext);
  return (
    <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR} className='mr-auto'>
      <a
        href={`${getEtherscanUrlForChain(activeChain)}/tx/${props.txnHash}`}
        target='_blank'
        rel='noopener noreferrer'
        className='underline'
      >
        View on Etherscan
      </a>
    </Text>
  );
}

export type PendingTxnModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  txnHash: `0x${string}` | null;
  status: PendingTxnModalStatus | null;
  onConfirm: () => void;
};

export default function PendingTxnModal(props: PendingTxnModalProps) {
  const { isOpen, setIsOpen, txnHash, status, onConfirm } = props;
  const ModalComponent = status === PendingTxnModalStatus.PENDING ? LoadingModal : Modal;
  if (status == null) {
    return null;
  }
  return (
    <ModalComponent isOpen={isOpen} setIsOpen={setIsOpen} title={STATUS_TITLES[status]}>
      {status === PendingTxnModalStatus.PENDING && (
        <>
          <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR} className='mb-6'>
            This might take a while. Feel free to leave the page and come back later.
          </Text>
          {txnHash && <EtherscanLink txnHash={txnHash} />}
        </>
      )}
      {status === PendingTxnModalStatus.SUCCESS && (
        <>
          <SuccessIcon className='mb-6' />
          <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR} className='mb-6'>
            Your transaction has been confirmed.
          </Text>
          {txnHash && <EtherscanLink txnHash={txnHash} />}
          <FilledGradientButton
            size='M'
            onClick={() => {
              onConfirm();
            }}
            fillWidth={true}
            className='mt-6'
          >
            Okay
          </FilledGradientButton>
        </>
      )}
      {status === PendingTxnModalStatus.FAILURE && (
        <>
          <ErrorIcon width={64} height={64} className='mb-6' />
          <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR} className='mb-6'>
            Something went wrong. Please try again later.
          </Text>
          {txnHash && <EtherscanLink txnHash={txnHash} />}
          <FilledGradientButton
            size='M'
            onClick={() => {
              setIsOpen(false);
            }}
            fillWidth={true}
            className='mt-6'
          >
            Okay
          </FilledGradientButton>
        </>
      )}
    </ModalComponent>
  );
}
