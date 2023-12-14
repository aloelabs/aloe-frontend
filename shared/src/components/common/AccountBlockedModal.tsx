import Modal from './Modal';
import { Text } from './Typography';

export type AccountBlockedModalProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

export default function AccountBlockedModal(props: AccountBlockedModalProps) {
  const { isOpen, setIsOpen } = props;

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Account Blocked' noClose>
      <div>
        <Text size='M'>This address is blocked on the Aloe Labs frontend due to its association sanctions.</Text>
      </div>
    </Modal>
  );
}
