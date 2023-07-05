import { useEffect, useState } from 'react';

import { GetAccountResult, Provider } from '@wagmi/core';
import { FilledStylizedButton } from '../common/Buttons';
import { Text } from '../common/Typography';
import { getIconForWagmiConnectorNamed } from './ConnectorIconMap';
import styled from 'styled-components';
import { Chain, useConnect } from 'wagmi';

import Modal, { MODAL_BLACK_TEXT_COLOR } from '../common/Modal';
import { GREY_700 } from '../../data/constants/Colors';

const Container = styled.div.attrs((props: { fillWidth: boolean }) => props)`
  width: ${(props) => (props.fillWidth ? '100%' : 'max-content')};
`;

export type ConnectWalletButtonProps = {
  account?: GetAccountResult<Provider>;
  activeChain: Chain;
  checkboxes: React.ReactNode[];
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
            <div>
              {connectors.map((connector) => (
                <div key={connector.id} className='py-2 w-full flex flex-row gap-4 items-center justify-between'>
                  {getIconForWagmiConnectorNamed(connector.name)}
                  <FilledStylizedButton
                    name='Connect'
                    size='M'
                    backgroundColor={GREY_700}
                    color={'rgba(255, 255, 255, 1)'}
                    fillWidth={true}
                    disabled={!connector.ready}
                    onClick={() => {
                      // Manually close the modal when the connector is connecting
                      // This indicates the connector's modal/popup is or will soon be open
                      connector.addListener('message', (m) => {
                        if (m.type === 'connecting') {
                          setWalletModalOpen(false);
                          connector.removeListener('message');
                        }
                      });
                      connect({ connector });
                    }}
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
            <div className='flex flex-col gap-2'>
              <Text size='M' weight='regular' color='hsla(205, 47%, 87%, 1)' className='mb-4'>
                At Aloe Labs, we believe everyone should be able to use financial services without being surveilled. But
                running a site like this makes some data collection inevitable, and the US Government feels differently
                about financial access and surveillance.{' '}
                <strong>As such, we have to ask you to confirm the following:</strong>
              </Text>
              {checkboxes?.map((checkbox, index) => (
                <label className='flex items-start gap-2' key={index}>
                  <div className='mt-1'>
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
                  {checkbox}
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
