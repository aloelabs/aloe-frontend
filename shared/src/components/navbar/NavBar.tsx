import React, { useEffect, useState } from 'react';

import { Popover } from '@headlessui/react';
import { NavLink } from 'react-router-dom';
import DiscordFooterIcon from '../../assets/svg/DiscordFooter';
import MediumFooterIcon from '../../assets/svg/MediumFooter';
import TwitterFooterIcon from '../../assets/svg/TwitterFooter';
import { Text } from '../common/Typography';
import { RESPONSIVE_BREAKPOINT_SM } from '../../data/constants/Breakpoints';
import styled from 'styled-components';
import { Chain, useAccount, useNetwork } from 'wagmi';

import AloeMobileLogo from '../../assets/svg/AloeCapitalLogo';
import AloeDesktopLogo from '../../assets/svg/AloeCapitalNavLogo';
import EllipsisIcon from '../../assets/svg/Ellipsis';
import AccountInfo from './AccountInfo';
import ChainSelector from './ChainSelector';
import ConnectWalletButton from './ConnectWalletButton';

const FOOTER_LINK_TEXT_COLOR = 'rgba(75, 105, 128, 1)';

const DesktopLogo = styled(AloeDesktopLogo)`
  width: 100px;
  height: 40px;
  margin-right: 32px;
  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    display: none;
  }
`;

const MobileLogo = styled(AloeMobileLogo)`
  width: 40px;
  height: 40px;
  margin-right: 32px;
  @media (min-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    display: none;
  }
`;

const DesktopTopNav = styled.div`
  position: fixed;
  top: 0px;
  left: 0px;
  right: 0px;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 32px;
`;

const MobileBottomNav = styled.div`
  position: fixed;
  display: flex;
  justify-content: space-between;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background-color: rgba(6, 11, 15, 1);
  border-top: 1px solid rgba(26, 41, 52, 1);
  padding: 8px 16px;

  @media (min-width: 768px) {
    display: none;
  }
`;

const VerticalDivider = styled.div`
  width: 1px;
  height: 64px;
  background-color: rgba(26, 41, 52, 1);

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    width: 100%;
    height: 1px;
  }
`;

const FooterLink = styled(Text)`
  padding: 8px 16px;
  &:hover {
    color: rgba(255, 255, 255, 1);
  }
`;

const DesktopNavLinks = styled.div`
  display: flex;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    display: none;
  }
`;

const DesktopNavLink = styled(NavLink)`
  width: fit-content;
  padding: 20px 32px;
  cursor: pointer;
  user-select: none;

  &.active {
    color: rgba(255, 255, 255, 1);
  }

  :hover:not(&.active) {
    color: ${FOOTER_LINK_TEXT_COLOR};
  }

  &.mobile {
    border-bottom: 1px solid rgba(26, 41, 52, 1);
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    width: 100%;
    padding: 12px 0px;
  }
`;

const MobileNavLink = styled(NavLink)`
  display: flex;
  align-items: center;
  padding: 8px 16px;

  &:hover {
    background-color: rgba(26, 41, 52, 1);
    border-radius: 8px;
  }
`;

const StyledPopoverButton = styled(Popover.Button)`
  display: flex;
  align-items: center;
  padding: 0px 16px;

  &:hover {
    background-color: rgba(26, 41, 52, 1);
    border-radius: 8px;
  }
`;

const StyledPopoverPanel = styled(Popover.Panel)`
  position: absolute;
  bottom: 72px;
  right: 16px;
  z-index: 50;
  /* background-color: rgba(6, 11, 15, 1); */
  background-color: rgb(13, 23, 30);
  border: 1px solid rgba(26, 41, 52, 1);
  border-radius: 8px;
  padding: 16px;
`;

export type NavBarLink = {
  label: string;
  to: string;
};

export type NavBarProps = {
  links: NavBarLink[];
  isAllowedToInteract: boolean;
  activeChain: Chain;
  setActiveChain(c: Chain): void;
};

export function NavBar(props: NavBarProps) {
  const { links, isAllowedToInteract, activeChain, setActiveChain } = props;
  const account = useAccount();
  const network = useNetwork();
  const [isSelectChainDropdownOpen, setIsSelectChainDropdownOpen] = useState(false);
  useEffect(() => {
    // Close the chain selector dropdown when the chain changes
    setIsSelectChainDropdownOpen(false);
  }, [network.chain]);

  const isOffline = !account.isConnected && !account.isConnecting;

  return (
    <>
      <DesktopTopNav>
        <a href='/' title='home'>
          <MobileLogo />
          <DesktopLogo />
        </a>
        <DesktopNavLinks>
          <VerticalDivider />
          {links.map((link, index) => (
            <React.Fragment key={index}>
              <DesktopNavLink key={link.to} to={link.to}>
                <Text size='M'>{link.label}</Text>
              </DesktopNavLink>
              <VerticalDivider />
            </React.Fragment>
          ))}
        </DesktopNavLinks>
        <div className='flex gap-4 items-center ml-auto'>
          <ChainSelector
            activeChain={activeChain}
            isOffline={isOffline}
            isOpen={isSelectChainDropdownOpen}
            setIsOpen={setIsSelectChainDropdownOpen}
            setActiveChain={setActiveChain}
          />
          {!activeChain || !account.address ? (
            <ConnectWalletButton account={account} activeChain={activeChain} disabled={!isAllowedToInteract} />
          ) : (
            <AccountInfo
              account={account}
              chain={activeChain}
              closeChainSelector={() => setIsSelectChainDropdownOpen(false)}
            />
          )}
        </div>
      </DesktopTopNav>
      <MobileBottomNav>
        {props.links.map((link, index) => (
          <MobileNavLink key={index} to={link.to}>
            <Text size='M' weight='bold'>
              {link.label}
            </Text>
          </MobileNavLink>
        ))}
        <Popover className='flex'>
          <StyledPopoverButton>
            <EllipsisIcon />
          </StyledPopoverButton>
          <StyledPopoverPanel>
            <div className='flex flex-col'>
              <FooterLink
                as='a'
                size='S'
                weight='medium'
                color={FOOTER_LINK_TEXT_COLOR}
                href={'https://aloe.capital/'}
                target='_blank'
                rel='noopener noreferrer'
              >
                Main site
              </FooterLink>
              <FooterLink
                as='a'
                size='S'
                weight='medium'
                color={FOOTER_LINK_TEXT_COLOR}
                href={'https://docs.aloe.capital/'}
                target='_blank'
                rel='noopener noreferrer'
              >
                Docs
              </FooterLink>
              <FooterLink
                as='a'
                size='S'
                weight='medium'
                color={FOOTER_LINK_TEXT_COLOR}
                href={'/terms.pdf'}
                target='_blank'
                rel='noopener noreferrer'
              >
                Terms
              </FooterLink>
            </div>
            <div className='flex flex-row justify-between mt-2'>
              <a
                href={'https://discord.com/invite/gpt4sUv6sw'}
                target='_blank'
                rel='noopener noreferrer'
                title='Join our Discord'
              >
                <DiscordFooterIcon width={14} height={11} />
              </a>
              <a
                href={'https://twitter.com/aloecapital'}
                target='_blank'
                rel='noopener noreferrer'
                title='Follow us on Twitter'
              >
                <TwitterFooterIcon width={15} height={11} />
              </a>
              <a
                href={'https://aloelabs.medium.com'}
                target='_blank'
                rel='noopener noreferrer'
                title='Connect with us on Medium'
              >
                <MediumFooterIcon width={21} height={11} />
              </a>
            </div>
          </StyledPopoverPanel>
        </Popover>
      </MobileBottomNav>
    </>
  );
}
