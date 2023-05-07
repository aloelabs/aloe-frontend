import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';

export type BridgeModalProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export default function BridgeModal(props: BridgeModalProps) {
  const { isOpen, setIsOpen } = props;
  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Bridge' maxWidth='500px'>
      <Text size='M' className='mb-8'>
        Coming soon!
      </Text>
    </Modal>
  );
}
