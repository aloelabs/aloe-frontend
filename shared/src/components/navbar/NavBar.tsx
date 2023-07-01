import React, { useEffect, useState } from 'react';

import { Popover } from '@headlessui/react';
import { NavLink } from 'react-router-dom';
import DiscordFooterIcon from '../../assets/svg/DiscordFooter';
import MediumFooterIcon from '../../assets/svg/MediumFooter';
import TwitterFooterIcon from '../../assets/svg/TwitterFooter';
import CloseModal from '../../assets/svg/CloseModal';
import MenuIcon from '../../assets/svg/Menu';
import { Text } from '../common/Typography';
import styled from 'styled-components';
import { Chain, useAccount, useNetwork, useDisconnect } from 'wagmi';

import AloeMobileLogo from '../../assets/svg/AloeCapitalLogo';
import AloeDesktopLogo from '../../assets/svg/AloeCapitalNavLogo';
import EllipsisIcon from '../../assets/svg/Ellipsis';
import AccountInfo from './AccountInfo';
import ChainSelector from './ChainSelector';
import ConnectWalletButton from './ConnectWalletButton';
import {
  RESPONSIVE_BREAKPOINTS,
  RESPONSIVE_BREAKPOINT_TABLET,
  RESPONSIVE_BREAKPOINT_XS,
} from '../../data/constants/Breakpoints';
import useMediaQuery from '../../data/hooks/UseMediaQuery';
import useLockScroll from '../../data/hooks/UseLockScroll';
import { GREY_700, GREY_800 } from '../../data/constants/Colors';

const FOOTER_LINK_TEXT_COLOR = 'rgba(75, 105, 128, 1)';

const DesktopLogo = styled(AloeDesktopLogo)`
  width: 100px;
  height: 40px;
  margin-right: 32px;
  @media (max-width: ${RESPONSIVE_BREAKPOINT_TABLET}) {
    display: none;
  }
`;

const MobileLogo = styled(AloeMobileLogo)`
  width: 40px;
  height: 40px;
  margin-right: 32px;
  @media (min-width: ${RESPONSIVE_BREAKPOINT_TABLET}) {
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

const TabletBottomNav = styled.div`
  position: fixed;
  display: flex;
  justify-content: space-between;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background-color: rgba(6, 11, 15, 1);
  border-top: 1px solid ${GREY_700};
  padding: 8px 16px;

  @media (min-width: ${RESPONSIVE_BREAKPOINT_TABLET}) {
    display: none;
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    display: none;
  }
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
  border-top: 1px solid ${GREY_700};
  padding: 8px 16px;

  @media (min-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    display: none;
  }
`;

const VerticalDivider = styled.div`
  width: 1px;
  height: 64px;
  background-color: ${GREY_700};

  @media (max-width: ${RESPONSIVE_BREAKPOINT_TABLET}) {
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

const ExternalFooterLinkWithIcon = styled.a`
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;

  padding: 8px 16px;
  color: ${FOOTER_LINK_TEXT_COLOR};
  &:hover {
    color: rgba(255, 255, 255, 1);

    svg {
      path {
        fill: rgba(255, 255, 255, 1);
      }
    }
  }
`;

const DesktopNavLinks = styled.div`
  display: flex;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_TABLET}) {
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
    border-bottom: 1px solid ${GREY_700};
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_TABLET}) {
    width: 100%;
    padding: 12px 0px;
  }
`;

const ExternalDesktopLink = styled.a`
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
    border-bottom: 1px solid ${GREY_700};
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_TABLET}) {
    width: 100%;
    padding: 12px 0px;
  }
`;

const MobileNavLink = styled(NavLink)`
  display: flex;
  align-items: center;
  padding: 8px 16px;

  &:hover {
    background-color: ${GREY_700};
    border-radius: 8px;
  }
`;

const MobileExternalLink = styled.a`
  display: flex;
  align-items: center;
  padding: 8px 16px;

  &:hover {
    background-color: ${GREY_700};
    border-radius: 8px;
  }
`;

const StyledPopoverButton = styled(Popover.Button)`
  display: flex;
  align-items: center;
  padding: 0px 16px;

  &:hover {
    background-color: ${GREY_700};
    border-radius: 8px;
  }
`;

const StyledPopoverPanel = styled(Popover.Panel)`
  position: absolute;
  bottom: 72px;
  right: 16px;
  z-index: 50;
  /* background-color: rgba(6, 11, 15, 1); */
  background-color: ${GREY_800};
  border: 1px solid ${GREY_700};
  border-radius: 8px;
  padding: 16px;
`;

const NavOverlay = styled.div`
  position: fixed;
  top: 64px;
  bottom: 64px;
  left: 0;
  right: 0;
  background-color: ${GREY_800};
  z-index: 40;
  padding: 16px;
  overflow-y: scroll;

  @media (min-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    display: none;
  }
`;

const MenuIconWrapper = styled.button`
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;

  svg {
    path {
      stroke: #ffffff;
    }
  }
`;

export type NavBarLink = {
  label: string;
  to: string;
  isExternal?: boolean;
};

export type NavBarProps = {
  links: NavBarLink[];
  isAllowedToInteract: boolean;
  activeChain: Chain;
  checkboxes: React.ReactNode[];
  setActiveChain(c: Chain): void;
};

export function NavBar(props: NavBarProps) {
  const { links, isAllowedToInteract, activeChain, checkboxes, setActiveChain } = props;
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const account = useAccount();
  const network = useNetwork();
  const { disconnect } = useDisconnect();
  const [isSelectChainDropdownOpen, setIsSelectChainDropdownOpen] = useState(false);
  const { lockScroll, unlockScroll } = useLockScroll();
  useEffect(() => {
    // Close the chain selector dropdown when the chain changes
    setIsSelectChainDropdownOpen(false);
  }, [network.chain]);

  const isOffline = !account.isConnected && !account.isConnecting;

  const isBiggerThanMobile = useMediaQuery(RESPONSIVE_BREAKPOINTS.XS);

  useEffect(() => {
    if (isNavDrawerOpen && isBiggerThanMobile) {
      setIsNavDrawerOpen(false);
      unlockScroll();
    }
  }, [isBiggerThanMobile, isNavDrawerOpen, unlockScroll]);

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
              {link.isExternal ? (
                <ExternalDesktopLink href={link.to} target='_blank' rel='noopener noreferrer'>
                  <Text size='M'>{link.label}</Text>
                </ExternalDesktopLink>
              ) : (
                <DesktopNavLink to={link.to}>
                  <Text size='M'>{link.label}</Text>
                </DesktopNavLink>
              )}
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
            <ConnectWalletButton
              account={account}
              checkboxes={checkboxes}
              activeChain={activeChain}
              disabled={!isAllowedToInteract}
            />
          ) : (
            <AccountInfo
              account={account}
              chain={activeChain}
              closeChainSelector={() => setIsSelectChainDropdownOpen(false)}
              disconnect={disconnect}
            />
          )}
        </div>
      </DesktopTopNav>
      <TabletBottomNav>
        {props.links.map((link, index) => (
          <React.Fragment key={index}>
            {link.isExternal ? (
              <MobileExternalLink href={link.to} target='_blank' rel='noopener noreferrer'>
                <Text size='M' weight='bold'>
                  {link.label}
                </Text>
              </MobileExternalLink>
            ) : (
              <MobileNavLink to={link.to}>
                <Text size='M' weight='bold'>
                  {link.label}
                </Text>
              </MobileNavLink>
            )}
          </React.Fragment>
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
      </TabletBottomNav>
      <MobileBottomNav>
        <MenuIconWrapper
          onClick={() => {
            if (isNavDrawerOpen) {
              setIsNavDrawerOpen(false);
              unlockScroll();
            } else {
              lockScroll();
              setIsNavDrawerOpen(true);
            }
          }}
        >
          {isNavDrawerOpen ? <CloseModal width={28} height={28} /> : <MenuIcon width={28} height={28} />}
        </MenuIconWrapper>
      </MobileBottomNav>
      {isNavDrawerOpen && (
        <NavOverlay>
          <div className='flex flex-col justify-between h-full'>
            <div className='flex flex-col gap-4'>
              {props.links.map((link, index) => (
                <React.Fragment key={index}>
                  {link.isExternal ? (
                    <MobileExternalLink href={link.to} target='_blank' rel='noopener noreferrer'>
                      <Text size='XL' weight='bold'>
                        {link.label}
                      </Text>
                    </MobileExternalLink>
                  ) : (
                    <MobileNavLink
                      to={link.to}
                      onClick={() => {
                        setIsNavDrawerOpen(false);
                        unlockScroll();
                      }}
                    >
                      <Text size='XL' weight='bold'>
                        {link.label}
                      </Text>
                    </MobileNavLink>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className='mt-4'>
              <div className='flex flex-col gap-2'>
                <FooterLink
                  as='a'
                  size='M'
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
                  size='M'
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
                  size='M'
                  weight='medium'
                  color={FOOTER_LINK_TEXT_COLOR}
                  href={'/terms.pdf'}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  Terms
                </FooterLink>
              </div>
              <div className='flex flex-col gap-2 mt-2'>
                <ExternalFooterLinkWithIcon
                  href={'https://discord.com/invite/gpt4sUv6sw'}
                  target='_blank'
                  rel='noopener noreferrer'
                  title='Join our Discord'
                  className=''
                >
                  <DiscordFooterIcon width={14} height={11} />
                  <Text size='M' weight='medium' color='unset'>
                    Discord
                  </Text>
                </ExternalFooterLinkWithIcon>
                <ExternalFooterLinkWithIcon
                  href={'https://twitter.com/aloecapital'}
                  target='_blank'
                  rel='noopener noreferrer'
                  title='Follow us on Twitter'
                >
                  <TwitterFooterIcon width={15} height={11} />
                  <Text size='M' weight='medium' color='unset'>
                    Twitter
                  </Text>
                </ExternalFooterLinkWithIcon>
                <ExternalFooterLinkWithIcon
                  href={'https://aloelabs.medium.com'}
                  target='_blank'
                  rel='noopener noreferrer'
                  title='Connect with us on Medium'
                >
                  <MediumFooterIcon width={21} height={11} />
                  <Text size='M' weight='medium' color='unset'>
                    Medium
                  </Text>
                </ExternalFooterLinkWithIcon>
              </div>
            </div>
          </div>
        </NavOverlay>
      )}
    </>
  );
}
