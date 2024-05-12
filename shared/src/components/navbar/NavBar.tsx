import React, { useEffect, useMemo, useState } from 'react';

import { Popover } from '@headlessui/react';
import { NavLink } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import DiscordFooterIcon from '../../assets/svg/DiscordFooter';
import MediumFooterIcon from '../../assets/svg/MediumFooter';
import TwitterFooterIcon from '../../assets/svg/TwitterFooter';
import CloseModal from '../../assets/svg/CloseModal';
import MenuIcon from '../../assets/svg/Menu';
import { Text } from '../common/Typography';
import styled from 'styled-components';
import { useAccount, useDisconnect } from 'wagmi';

import AloeMobileLogo from '../../assets/svg/AloeCapitalLogo';
import AloeDesktopLogo from '../../assets/svg/AloeCapitalNavLogo';
import EllipsisIcon from '../../assets/svg/Ellipsis';
import AccountInfo from './AccountInfo';
import ChainSelector from './ChainSelector';
import ConnectWalletButton from './ConnectWalletButton';
import { RESPONSIVE_BREAKPOINTS } from '../../data/constants/Breakpoints';
import useMediaQuery from '../../data/hooks/UseMediaQuery';
import useLockScroll from '../../data/hooks/UseLockScroll';
import { GREY_400, GREY_700, GREY_800 } from '../../data/constants/Colors';
import { API_LEADERBOARD_URL, TERMS_OF_SERVICE_URL } from '../../data/constants/Values';
import { OutlinedGradientRoundedButton } from '../common/Buttons';
import { GN, GNFormat } from '../../data/GoodNumber';
import axios, { AxiosResponse } from 'axios';
import { Chain } from 'viem';

const DesktopLogo = styled(AloeDesktopLogo)`
  width: 100px;
  height: 40px;
  margin-right: 32px;
  @media (max-width: ${RESPONSIVE_BREAKPOINTS.TABLET}px) {
    display: none;
  }
`;

const MobileLogo = styled(AloeMobileLogo)`
  width: 40px;
  height: 40px;
  margin-right: 32px;
  @media (min-width: ${RESPONSIVE_BREAKPOINTS.TABLET + 1}px) {
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

  @media (min-width: ${RESPONSIVE_BREAKPOINTS.TABLET + 1}px) {
    display: none;
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINTS.XS}px) {
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

  @media (min-width: ${RESPONSIVE_BREAKPOINTS.XS + 1}px) {
    display: none;
  }
`;

const VerticalDivider = styled.div`
  width: 1px;
  height: 64px;
  background-color: ${GREY_700};

  @media (max-width: ${RESPONSIVE_BREAKPOINTS.TABLET}px) {
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
  color: ${GREY_400};
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

  @media (max-width: ${RESPONSIVE_BREAKPOINTS.TABLET}px) {
    display: none;
  }
`;

const DesktopNavLink = styled(NavLink)`
  width: fit-content;
  padding: 20px 32px;
  cursor: pointer;
  user-select: none;
  color: ${GREY_400};

  &.active {
    color: white;
  }

  &:hover {
    color: white;
  }

  &.mobile {
    border-bottom: 1px solid ${GREY_700};
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINTS.TABLET}px) {
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
    color: ${GREY_400};
  }

  &.mobile {
    border-bottom: 1px solid ${GREY_700};
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINTS.TABLET}px) {
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

  @media (min-width: ${RESPONSIVE_BREAKPOINTS.XS + 1}px) {
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
  const navigate = useNavigate();
  const account = useAccount();
  const { chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { lockScroll, unlockScroll } = useLockScroll();

  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const [isSelectChainDropdownOpen, setIsSelectChainDropdownOpen] = useState(false);
  // TODO: Put leaderboardEntries into a shared context so that the Leaderboard Page doesn't have to refetch everything
  const [leaderboardEntries, setLeaderboardEntries] = useState<{ address: string; score: string }[]>([]);

  useEffect(() => {
    // Close the chain selector dropdown when the chain changes
    setIsSelectChainDropdownOpen(false);
  }, [chain]);

  useEffect(() => {
    (async () => {
      let response: AxiosResponse<{ address: string; score: string }[]>;
      try {
        response = await axios.get(API_LEADERBOARD_URL);
      } catch (e) {
        return;
      }
      if (response.data) setLeaderboardEntries(response.data);
    })();
  }, [setLeaderboardEntries]);

  const accountPoints = useMemo(() => {
    if (account.address === undefined) return GN.zero(18);
    const entry = leaderboardEntries.find((x) => x.address.toLowerCase() === account.address!.toLowerCase());
    return entry === undefined ? GN.zero(18) : new GN(entry.score, 18, 10);
  }, [account.address, leaderboardEntries]);

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
                  {link.label}
                </ExternalDesktopLink>
              ) : (
                <DesktopNavLink to={link.to}>{link.label}</DesktopNavLink>
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
          {account.address !== undefined && (
            <OutlinedGradientRoundedButton size='S' onClick={() => navigate('/leaderboard')}>
              {accountPoints.toString(GNFormat.LOSSY_HUMAN)} points
            </OutlinedGradientRoundedButton>
          )}
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
                color={GREY_400}
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
                color={GREY_400}
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
                color={GREY_400}
                href={TERMS_OF_SERVICE_URL}
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
                  color={GREY_400}
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
                  color={GREY_400}
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
                  color={GREY_400}
                  href={TERMS_OF_SERVICE_URL}
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
