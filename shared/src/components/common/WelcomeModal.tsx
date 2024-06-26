import { FilledGreyButton } from './Buttons';
import Modal from './Modal';
import { Text } from './Typography';
import ConnectWalletButton from '../navbar/ConnectWalletButton';
import styled from 'styled-components';

const StyledLink = styled.a`
  text-decoration: underline;
`;

export type WelcomeModalProps = {
  isOpen: boolean;
  checkboxes: React.ReactNode[];
  setIsOpen: (open: boolean) => void;
  onAcknowledged: () => void;
  onSkip?: () => void;
};

export default function WelcomeModal(props: WelcomeModalProps) {
  const { isOpen, checkboxes, setIsOpen, onAcknowledged, onSkip } = props;

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Welcome!'>
      <div>
        <Text size='M'>
          To access all Aloe features, you'll need to connect an Ethereum wallet. If you don't have one or you want to
          learn more about wallets, check out{' '}
          <StyledLink href='https://ethereum.org/en/wallets/' target='_blank' rel='noopener noreferrer'>
            this page
          </StyledLink>{' '}
          from the Ethereum foundation.
        </Text>
        <div className='w-full flex justify-between items-center mt-20'>
          <FilledGreyButton
            size='M'
            onClick={() => {
              onAcknowledged();
              setIsOpen(false);
              onSkip?.();
            }}
          >
            Skip for now
          </FilledGreyButton>
          <ConnectWalletButton shouldShortenText={false} checkboxes={checkboxes} />
        </div>
      </div>
    </Modal>
  );
}
