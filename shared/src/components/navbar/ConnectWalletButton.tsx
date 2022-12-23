import { useEffect, useState } from 'react';

import { FilledStylizedButton } from '../common/Buttons';
import { Text } from '../common/Typography';
import styled from 'styled-components';
import { Chain, useConnect } from 'wagmi';

import { CloseableModal } from '../common/Modal';
import { getIconForWagmiConnectorNamed } from './ConnectorIconMap';
import { GetAccountResult, Provider } from '@wagmi/core';
import { DEFAULT_CHAIN } from '../../data/constants/Values';

const Container = styled.div`
  width: 100%;
`;

export type ConnectWalletButtonProps = {
  account?: GetAccountResult<Provider>;
  activeChain?: Chain;
  disabled?: boolean;
  fillWidth?: boolean;
};

export default function ConnectWalletButton(props: ConnectWalletButtonProps) {
  // MARK: component props
  const { account, activeChain, disabled, fillWidth } = props;
  const isConnected = account?.isConnected ?? false;

  // MARK: component state
  const [switchChainPromptModalOpen, setSwitchChainPromptModalOpen] = useState<boolean>(false);
  const [walletModalOpen, setWalletModalOpen] = useState<boolean>(false);

  // MARK: wagmi hooks
  const { connect, connectors, error } = useConnect({ chainId: activeChain?.id ?? DEFAULT_CHAIN.id });

  useEffect(() => {
    if (isConnected) {
      setWalletModalOpen(false);
    }
  }, [isConnected]);

  return (
    <Container>
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
      <CloseableModal open={switchChainPromptModalOpen} setOpen={setSwitchChainPromptModalOpen} title={'Switch Chain'}>
        <div className='w-full'></div>
      </CloseableModal>
      <CloseableModal open={walletModalOpen} setOpen={setWalletModalOpen} title={'Connect Wallet'}>
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
                  name='Disconnect'
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
      </CloseableModal>
    </Container>
  );
}
