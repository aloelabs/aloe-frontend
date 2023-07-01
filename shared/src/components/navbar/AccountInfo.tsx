import { useEffect, useState } from 'react';

import { Popover } from '@headlessui/react';
import { GetAccountResult, Provider } from '@wagmi/core';
import { FilledGreyButton, FilledGreyButtonWithIcon, FilledStylizedButton } from '../common/Buttons';
import { Text } from '../common/Typography';
import { RESPONSIVE_BREAKPOINT_MD, RESPONSIVE_BREAKPOINT_SM } from '../../data/constants/Breakpoints';
import styled from 'styled-components';
import { Chain, useConnect, useEnsName, chain as wagmiChain } from 'wagmi';

import CopyIcon from '../../assets/svg/Copy';
import PowerIcon from '../../assets/svg/Power';
import { formatAddress } from '../../util/FormatAddress';
import { CloseableModal } from '../common/Modal';
import { getIconForWagmiConnectorNamed } from './ConnectorIconMap';
import Identicon from './Identicon';
import { GREY_700, GREY_800 } from '../../data/constants/Colors';

const StyledPopoverPanel = styled(Popover.Panel)`
  position: absolute;
  z-index: 10;
  top: 64px;
  right: 32px;
  width: 350px;
  padding: 16px;
  border-radius: 8px;
  background-color: ${GREY_800};

  &:before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-radius: 8px;
    padding: 1.5px;
    background: linear-gradient(90deg, #9baaf3 0%, #7bd8c0 100%);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    width: 100%;
    right: 0;
  }
`;

const ButtonTextContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    display: none;
  }
`;

export type AccountInfoProps = {
  account: GetAccountResult<Provider>;
  chain: Chain;
  buttonStyle?: 'secondary' | 'tertiary';
  closeChainSelector: () => void;
  disconnect: () => void;
};

export default function AccountInfo(props: AccountInfoProps) {
  // MARK: component props
  const { account, chain, closeChainSelector, disconnect } = props;
  const isConnected = account?.isConnected ?? false;
  const formattedAddr = account?.address ? formatAddress(account.address) : '';
  const { data: ensName } = useEnsName({
    address: account.address,
    chainId: wagmiChain.mainnet.id,
  });
  const buttonText = isConnected ? (ensName ? ensName : formattedAddr) : 'Connect Wallet';

  // MARK: component state
  const [switchChainPromptModalOpen, setSwitchChainPromptModalOpen] = useState<boolean>(false);
  const [walletModalOpen, setWalletModalOpen] = useState<boolean>(false);

  // MARK: wagmi hooks
  const { connect, connectors, error } = useConnect({ chainId: chain.id });

  useEffect(() => {
    if (isConnected) {
      setWalletModalOpen(false);
    }
  }, [isConnected]);

  return (
    <div>
      {!isConnected && (
        <FilledGreyButton onClick={() => setWalletModalOpen(true)} size='M'>
          Connect Wallet
        </FilledGreyButton>
      )}
      {isConnected && (
        <Popover>
          {({ open }) => (
            <>
              <Popover.Button
                className='outline-none flex justify-center items-center gap-2'
                onClick={() => {
                  // A hack to close the chain selector when the user clicks on the account info button
                  closeChainSelector();
                }}
              >
                <Identicon />
                <ButtonTextContainer>{buttonText}</ButtonTextContainer>
              </Popover.Button>
              {open && (
                <StyledPopoverPanel>
                  {account?.address !== undefined && (
                    <div className='flex items-center justify-between'>
                      <div className='flex gap-2 items-center'>
                        <Identicon />
                        <Text size='M' className='overflow-hidden text-ellipsis' title={account.address}>
                          {buttonText}
                        </Text>
                      </div>
                      <div className='flex gap-2 items-center'>
                        <FilledGreyButtonWithIcon
                          Icon={<CopyIcon />}
                          size='S'
                          svgColorType='stroke'
                          position='center'
                          onClick={() => {
                            if (account.address) {
                              navigator.clipboard.writeText(account.address);
                            }
                          }}
                        />
                        <FilledGreyButtonWithIcon
                          Icon={<PowerIcon />}
                          size='S'
                          svgColorType='stroke'
                          position='center'
                          onClick={() => {
                            disconnect();
                          }}
                        />
                      </div>
                    </div>
                  )}
                </StyledPopoverPanel>
              )}
            </>
          )}
        </Popover>
      )}
      <CloseableModal
        isOpen={switchChainPromptModalOpen}
        setIsOpen={setSwitchChainPromptModalOpen}
        title={'Switch Chain'}
      >
        <div className='w-full'></div>
      </CloseableModal>
      <CloseableModal isOpen={walletModalOpen} setIsOpen={setWalletModalOpen} title={'Connect Wallet'}>
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
              <div key={connector.id} className=' py-2 w-full flex flex-row items-center justify-between'>
                {getIconForWagmiConnectorNamed(connector.name)}
                <FilledStylizedButton
                  name='Disconnect'
                  size='M'
                  backgroundColor={GREY_700}
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
    </div>
  );
}
