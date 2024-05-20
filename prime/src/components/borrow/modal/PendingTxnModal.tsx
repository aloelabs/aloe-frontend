import { LoadingModal, MESSAGE_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import useChain from 'shared/lib/data/hooks/UseChain';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';

export type PendingTxnModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  txnHash?: string;
};

export default function PendingTxnModal(props: PendingTxnModalProps) {
  const activeChain = useChain();
  return (
    <LoadingModal isOpen={props.open} setIsOpen={props.setOpen} title='Submitting Order'>
      <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR}>
        This might take a while. Feel free to leave the page and come back later.
      </Text>
      {props.txnHash && (
        <Text size='M' weight='medium' color={MESSAGE_TEXT_COLOR}>
          <a
            href={`${getEtherscanUrlForChain(activeChain)}/tx/${props.txnHash}`}
            target='_blank'
            rel='noopener noreferrer'
            className='underline'
          >
            View on Etherscan
          </a>
        </Text>
      )}
    </LoadingModal>
  );
}
