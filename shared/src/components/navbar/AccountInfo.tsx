import { useState } from 'react';

import { Popover } from '@headlessui/react';
import { useDisconnect, type UseAccountReturnType } from 'wagmi';
import { FilledGreyButtonWithIcon, FilledStylizedButton } from '../common/Buttons';
import { Text } from '../common/Typography';
import { RESPONSIVE_BREAKPOINT_MD, RESPONSIVE_BREAKPOINT_SM } from '../../data/constants/Breakpoints';
import styled from 'styled-components';
import { useEnsName } from 'wagmi';

import CopyIcon from '../../assets/svg/Copy';
import PowerIcon from '../../assets/svg/Power';
import { formatAddress } from '../../util/FormatAddress';
import Modal, { CloseableModal } from '../common/Modal';
import Identicon from './Identicon';
import { GREY_800 } from '../../data/constants/Colors';
import Bell from '../../assets/svg/Bell';
import { QRCodeSVG } from 'qrcode.react';
import { NOTIFICATION_BOT_URL, TERMS_OF_SERVICE_URL } from '../../data/constants/Values';
import { mainnet } from 'viem/chains';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const TERTIARY_COLOR = '#4b6980';

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

const QRCodeContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 162px;
  height: 162px;
  border-radius: 8px;
  background-color: white;
`;

export type AccountInfoProps = {
  account: UseAccountReturnType;
  buttonStyle?: 'secondary' | 'tertiary';
  closeChainSelector: () => void;
};

export default function AccountInfo(props: AccountInfoProps) {
  // MARK: component props
  const { account, closeChainSelector } = props;
  const formattedAddr = account?.address ? formatAddress(account.address) : '';
  const { data: ensName } = useEnsName({
    address: account.address,
    chainId: mainnet.id,
  });
  const buttonText = ensName ? ensName : formattedAddr;

  // MARK: component state
  const [switchChainPromptModalOpen, setSwitchChainPromptModalOpen] = useState<boolean>(false);
  const [enableNotificationsModalOpen, setEnableNotificationsModalOpen] = useState<boolean>(false);

  // MARK: wagmi hooks
  const { disconnect } = useDisconnect();

  return (
    <div>
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
                  <div className='flex flex-col gap-2 w-full'>
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
                    <div className='flex flex-col gap-2'>
                      <div>
                        <Text size='S'>Notifications</Text>
                        <Text size='XS' color={SECONDARY_COLOR}>
                          Receive Telegram messages when your positions are at risk of liquidation.
                        </Text>
                      </div>
                      <FilledGreyButtonWithIcon
                        size='S'
                        Icon={<Bell />}
                        svgColorType='stroke'
                        position='leading'
                        onClick={() => {
                          setEnableNotificationsModalOpen(true);
                        }}
                      >
                        Enable Notifications
                      </FilledGreyButtonWithIcon>
                    </div>
                  </div>
                )}
              </StyledPopoverPanel>
            )}
          </>
        )}
      </Popover>
      <CloseableModal
        isOpen={switchChainPromptModalOpen}
        setIsOpen={setSwitchChainPromptModalOpen}
        title={'Switch Chain'}
      >
        <div className='w-full'></div>
      </CloseableModal>
      <Modal
        isOpen={enableNotificationsModalOpen}
        setIsOpen={setEnableNotificationsModalOpen}
        title='Enable Notifications'
        maxWidth='400px'
      >
        <div className='flex flex-col gap-4 items-center text-center'>
          <Text size='M'>Sign up to receive Telegram messages two minutes before liquidation.</Text>
          <QRCodeContainer>
            <QRCodeSVG value={NOTIFICATION_BOT_URL} size={148} />
          </QRCodeContainer>
          <a href={NOTIFICATION_BOT_URL} target='_blank' rel='noreferrer'>
            <FilledStylizedButton size='M'>Open Telegram</FilledStylizedButton>
          </a>
          <Text size='XS' color={TERTIARY_COLOR} className='mt-2'>
            By enrolling, you agree to our{' '}
            <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
              Terms of Service
            </a>
            {''}, acknowledge that this service may not always work. Your address will be linked to your Telegram
            username in our database.
          </Text>
        </div>
      </Modal>
    </div>
  );
}
