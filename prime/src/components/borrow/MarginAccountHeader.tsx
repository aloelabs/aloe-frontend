import React, { useContext } from 'react';

import FeeTierContainer from 'shared/lib/components/common/FeeTierContainer';
import RoundedBadge, { BADGE_TEXT_COLOR } from 'shared/lib/components/common/RoundedBadge';
import { Display } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';
import styled from 'styled-components';
import tw from 'twin.macro';

import { ChainContext } from '../../App';
import { ReactComponent as OpenIcon } from '../../assets/svg/open.svg';
import {
  RESPONSIVE_BREAKPOINT_LG,
  RESPONSIVE_BREAKPOINT_SM,
  RESPONSIVE_BREAKPOINT_XS,
} from '../../data/constants/Breakpoints';
import { formatAddressStart } from '../../util/FormatAddress';

const MarginPairContainer = styled.div`
  ${tw`flex items-center`}
  column-gap: 16px;
  flex-direction: row;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    width: max-content;
    flex-direction: column;
    row-gap: 8px;
  }
`;

const TokenIconsWrapper = styled.div`
  ${tw`flex flex-row items-center justify-start -space-x-4`}
  width: 66.66px;
  height: 40px;
`;

const TokenIcon = styled.img`
  ${tw`rounded-full bg-white`}
  box-shadow: 0 0 0 3px black;
  width: 40px;
  height: 40px;
`;

const Dash = styled.div`
  ${tw`bg-white`}
  width: 13.43px;
  height: 4.64px;
`;

const MarginAccountBadges = styled.div`
  ${tw`flex gap-4`}

  @media (max-width: ${RESPONSIVE_BREAKPOINT_XS}) {
    flex-direction: column;
  }
`;

const Wrapper = styled.div`
  ${tw`flex gap-4 items-center`}

  @media (max-width: ${RESPONSIVE_BREAKPOINT_LG}) {
    flex-direction: column;
  }
`;

const MarginAccountLink = styled.a`
  &:hover {
    text-decoration: underline;
  }
`;

const StyledOpenIcon = styled(OpenIcon)`
  path {
    // While it should have this color by default, it is worth explicitly setting it
    stroke: ${BADGE_TEXT_COLOR};
  }
`;

export type MarginAccountHeaderProps = {
  token0: Token;
  token1: Token;
  feeTier: number;
  id: string;
};

export default function MarginAccountHeader(props: MarginAccountHeaderProps) {
  const { activeChain } = useContext(ChainContext);
  const baseEtherscanUrl = getEtherscanUrlForChain(activeChain);
  return (
    <Wrapper>
      <MarginPairContainer>
        <TokenIconsWrapper>
          <TokenIcon src={props.token0.logoURI} alt={props.token0.name} />
          <TokenIcon src={props.token1.logoURI} alt={props.token1.name} />
        </TokenIconsWrapper>
        <div className='flex justify-center items-center gap-4'>
          <Display size='L' weight='semibold'>
            {props.token0.symbol}
          </Display>
          <Dash />
          <Display size='L' weight='semibold'>
            {props.token1.symbol}
          </Display>
        </div>
      </MarginPairContainer>
      <MarginAccountBadges>
        <FeeTierContainer feeTier={props.feeTier} />
        <RoundedBadge title={props.id}>
          <MarginAccountLink
            href={`${baseEtherscanUrl}/address/${props.id}`}
            target='_blank'
            rel='noreferrer'
            className='flex items-top gap-1'
          >
            <span>{formatAddressStart(props.id, 8)}</span>
            <StyledOpenIcon width={16} height={16} />
          </MarginAccountLink>
        </RoundedBadge>
      </MarginAccountBadges>
    </Wrapper>
  );
}
