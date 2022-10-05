import { useEffect, useState } from 'react';
import { chain, useConnect, useDisconnect, useNetwork, useSwitchNetwork } from 'wagmi';

import { CloseableModal } from '../common/Modal';
import { formatAddress } from '../../util/FormatAddress';
import { FilledStylizedButton, OutlinedGradientRoundedButton } from '../common/Buttons';
import { mapConnectorNameToIcon } from './ConnectorIconMap';
import { Text } from 'shared/lib/components/common/Typography';

export type ConnectWalletButtonProps = {
  address?: string;
  ensName?: string;
  buttonStyle?: 'secondary' | 'tertiary';
};

export default function ConnectWalletButton(props: ConnectWalletButtonProps) {
  // MARK: component props
  const { address, ensName } = props;
  const formattedAddr = address ? formatAddress(address) : '';
  const buttonText = address ? (ensName ? ensName : formattedAddr) : 'Connect Wallet';

  // MARK: component state
  const [switchChainPromptModalOpen, setSwitchChainPromptModalOpen] = useState<boolean>(false);
  const [walletModalOpen, setWalletModalOpen] = useState<boolean>(false);
  const [shouldAttemptToSwitchNetwork, setShouldAttemptToSwitchNetwork] = useState<boolean>(true);

  // MARK: wagmi hooks
  const { connect, connectors, data: connectionData, error } = useConnect({ chainId: chain.goerli.id });
  const { chain: currentChain } = useNetwork();
  const { isLoading, switchNetwork } = useSwitchNetwork({
    chainId: chain.goerli.id,
    onError: (error) => {
      setShouldAttemptToSwitchNetwork(false);
    },
    onSuccess: () => {
      setShouldAttemptToSwitchNetwork(false);
    },
  });
  useEffect(() => {
    if (!isLoading && currentChain?.id !== chain.goerli.id && shouldAttemptToSwitchNetwork) {
      switchNetwork?.(chain.goerli.id);
    }
  }, [shouldAttemptToSwitchNetwork, currentChain, isLoading, switchNetwork]);
  const { disconnect } = useDisconnect();

  return (
    <div>
      {!props.buttonStyle && (
        <OutlinedGradientRoundedButton name={buttonText} size='S' onClick={() => setWalletModalOpen(true)}>
          {buttonText}
        </OutlinedGradientRoundedButton>
      )}
      {props.buttonStyle === 'secondary' && (
        <FilledStylizedButton
          name={buttonText}
          size='M'
          onClick={() => setWalletModalOpen(true)}
          backgroundColor='rgba(26, 41, 52, 1)'
          color='rgba(255, 255, 255, 1)'
          fillWidth={true}
        >
          {buttonText}
        </FilledStylizedButton>
      )}
      {props.buttonStyle === 'tertiary' && (
        <FilledStylizedButton
          name={buttonText}
          size='M'
          onClick={() => setWalletModalOpen(true)}
          fillWidth={true}
          className='!rounded-none !pt-5 !pb-5'
        >
          {buttonText}
        </FilledStylizedButton>
      )}
      <CloseableModal open={switchChainPromptModalOpen} setOpen={setSwitchChainPromptModalOpen} title={'Switch Chain'}>
        <div className='w-full'></div>
      </CloseableModal>
      <CloseableModal open={walletModalOpen} setOpen={setWalletModalOpen} title={'Connect Wallet'}>
        <div className='w-full'>
          {address ? (
            // We have an account connected
            <div
              className='flex flex-col gap-y-2 items-center justify-between
             p-2 rounded-md border-2 border-grey-200 bg-grey-100'
            >
              <div className='flex flex-col items-start justify-start w-full oveflow-hidden'>
                <Text size='M' className='w-full overflow-hidden text-ellipsis' title={address}>
                  {ensName ? `${ensName} (${formattedAddr})` : address}
                </Text>
                <Text size='S' color='rgb(194, 209, 221)' className='w-full overflow-hidden text-ellipsis'>
                  Connected to {connectionData?.connector?.name}
                </Text>
              </div>
              <FilledStylizedButton
                name='Disconnect'
                size='M'
                backgroundColor='rgba(26, 41, 52, 1)'
                color={'rgba(255, 255, 255, 1)'}
                fillWidth={true}
                onClick={() => disconnect()}
              >
                Disconnect
              </FilledStylizedButton>
            </div>
          ) : (
            // No account connected, display connection options
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
                <div key={connector.id} className=' py-2 w-full flex flex-row items-center justify-between'>
                  <img src={mapConnectorNameToIcon(connector.name)} alt='' className='w-10 h-10 mr-4' />
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
          )}
          {error && (
            <Text size='S' color='rgb(236, 45, 91)'>
              {error?.message ?? 'Failed to connect'}
            </Text>
          )}
        </div>
      </CloseableModal>
    </div>
  );
}
