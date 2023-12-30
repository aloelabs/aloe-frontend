import styled from 'styled-components';
import { TERMS_OF_SERVICE_URL } from '../../data/constants/Values';
import Modal from './Modal';
import { Text } from './Typography';

const StyledLink = styled.a`
  text-decoration: underline;
`;

export type AccountBlockedModalProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

export default function AccountBlockedModal(props: AccountBlockedModalProps) {
  const { isOpen, setIsOpen } = props;

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Account Blocked' noClose>
      <div>
        <Text size='M'>
          You cannot use this site. Your address cannot comply with the{' '}
          <StyledLink href={TERMS_OF_SERVICE_URL} target='_blank' rel='noreferrer'>
            Terms of Service
          </StyledLink>{' '}
          due to its sanctions status.
        </Text>
      </div>
    </Modal>
  );
}
