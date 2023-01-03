import { useEffect, useState } from 'react';

import { GetAccountResult, Provider } from '@wagmi/core';
import { FilledStylizedButton } from '../common/Buttons';
import { Text } from '../common/Typography';
import { getIconForWagmiConnectorNamed } from './ConnectorIconMap';
import styled from 'styled-components';
import { Chain, useConnect } from 'wagmi';

import Modal, { MODAL_BLACK_TEXT_COLOR } from '../common/Modal';

const Container = styled.div.attrs((props: { fillWidth: boolean }) => props)`
  width: ${(props) => (props.fillWidth ? '100%' : 'max-content')};
`;

const StyledLink = styled.a`
  text-decoration: underline;
`;

export type ConnectWalletButtonProps = {
  account?: GetAccountResult<Provider>;
  activeChain: Chain;
  checkboxes: string[];
  disabled?: boolean;
  fillWidth?: boolean;
  onConnected?: () => void;
};

export default function ConnectWalletButton(props: ConnectWalletButtonProps) {
  // MARK: component props
  const { account, activeChain, checkboxes, disabled, fillWidth, onConnected } = props;
  const [acknowledgedCheckboxes, setAcknowledgedCheckboxes] = useState<boolean[]>(() => {
    return checkboxes?.map(() => false) ?? [];
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const isConnected = account?.isConnected ?? false;

  // MARK: component state
  const [walletModalOpen, setWalletModalOpen] = useState<boolean>(false);

  // MARK: wagmi hooks
  const { connect, connectors, error } = useConnect({ chainId: activeChain.id });

  useEffect(() => {
    if (isConnected) {
      onConnected?.();
      setWalletModalOpen(false);
    }
  }, [isConnected, onConnected]);

  const acknowledgedAllCheckboxes = acknowledgedCheckboxes.every((acknowledged) => acknowledged);

  return (
    <Container fillWidth={fillWidth}>
      <FilledStylizedButton
        onClick={() => {
          setWalletModalOpen(true);
        }}
        size='M'
        fillWidth={fillWidth}
        disabled={disabled}
      >
        Connect Wallet
      </FilledStylizedButton>
      <Modal isOpen={walletModalOpen} setIsOpen={setWalletModalOpen} title={'Connect Wallet'}>
        {acceptedTerms ? (
          <div className='w-full'>
            <div className='py-2'>
              <Text size='M' weight='medium'>
                By connecting a wallet, I agree to Aloe Labs, Inc's{' '}
                <a
                  href={'/terms.pdf'}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='underline text-green-600 hover:text-green-700'
                >
                  Terms of Use
                </a>{' '}
                and{' '}
                <a
                  href={'/privacy.pdf'}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='underline text-green-600 hover:text-green-700'
                >
                  Privacy Policy
                </a>
                .
              </Text>
              {connectors.map((connector) => (
                <div key={connector.id} className=' py-2 w-full flex flex-row gap-4 items-center justify-between'>
                  {getIconForWagmiConnectorNamed(connector.name)}
                  <FilledStylizedButton
                    name='Connect'
                    size='M'
                    backgroundColor='rgba(26, 41, 52, 1)'
                    color={'rgba(255, 255, 255, 1)'}
                    fillWidth={true}
                    disabled={!connector.ready}
                    onClick={() => connect({ connector })}
                  >
                    {connector.name}
                    {!connector.ready && ' (unsupported)'}
                  </FilledStylizedButton>
                </div>
              ))}
            </div>
            {error && (
              <Text size='S' color='rgb(236, 45, 91)'>
                {error?.message ?? 'Failed to connect'}
              </Text>
            )}
          </div>
        ) : (
          <div>
            <div>
              <Text size='L' weight='bold' className='mb-8'>
                By using Aloe II, I agree to the{' '}
                <StyledLink href='/terms.pdf' target='_blank'>
                  Terms of Service
                </StyledLink>{' '}
                and confirm that I have read and understood the{' '}
                <StyledLink href='/privacy.pdf' target='_blank'>
                  Privacy Policy
                </StyledLink>
                .
              </Text>
              <div>
                <Text size='M'>I hearby further confirm that:</Text>
              </div>
              {checkboxes?.map((checkbox, index) => (
                <label className='flex items-center gap-2' key={index}>
                  <div>
                    <input
                      type='checkbox'
                      checked={acknowledgedCheckboxes[index]}
                      onChange={() => {
                        const newAcknowledgedCheckboxes = [...acknowledgedCheckboxes];
                        newAcknowledgedCheckboxes[index] = !newAcknowledgedCheckboxes[index];
                        setAcknowledgedCheckboxes(newAcknowledgedCheckboxes);
                      }}
                      className='w-4 h-4'
                    />
                  </div>
                  <Text size='M'>{checkbox}</Text>
                </label>
              ))}
            </div>
            <FilledStylizedButton
              size='M'
              fillWidth={false}
              color={MODAL_BLACK_TEXT_COLOR}
              className='mt-8'
              disabled={!acknowledgedAllCheckboxes}
              onClick={() => {
                setAcceptedTerms(true);
              }}
            >
              Accept and Continue
            </FilledStylizedButton>
          </div>
        )}
      </Modal>
    </Container>
  );
}
