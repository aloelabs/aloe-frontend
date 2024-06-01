import { Text } from './Typography';
import styled from 'styled-components';

import DiscordFooterIcon from '../../assets/svg/DiscordFooter';
import TwitterFooterIcon from '../../assets/svg/TwitterFooter';
import MediumFooterIcon from '../../assets/svg/MediumFooter';
import { RESPONSIVE_BREAKPOINTS } from '../../data/constants/Breakpoints';
import { GREY_400 } from '../../data/constants/Colors';
import { TERMS_OF_SERVICE_URL } from '../../data/constants/Values';

const StyledFooter = styled.footer`
  position: fixed;
  bottom: 0px;
  left: 0px;
  right: 0px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
  background-color: rgba(6, 11, 15, 1);
  border-top: 1px solid rgba(18, 29, 37, 1);
  padding-left: 20px;
  padding-right: 20px;
  z-index: 40;

  @media (max-width: ${RESPONSIVE_BREAKPOINTS.TABLET}px) {
    display: none;
  }
`;

const FooterLink = styled(Text)`
  &:hover {
    color: rgba(255, 255, 255, 1);
  }
`;

const VerticalDivider = styled.div`
  width: 1px;
  height: 12px;
  margin-left: 16px;
  margin-right: 16px;
  background-color: rgba(34, 54, 69, 1);
`;

export default function Footer() {
  return (
    <StyledFooter>
      <div className='flex flex-row items-center'>
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
        <VerticalDivider />
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
        <VerticalDivider />
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
      <div className='flex flex-row items-center gap-x-6'>
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
    </StyledFooter>
  );
}
