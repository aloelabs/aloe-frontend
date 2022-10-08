import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { RESPONSIVE_BREAKPOINT_SM, RESPONSIVE_BREAKPOINT_XS } from '../../data/constants/Breakpoints';
import { TokenData } from '../../data/TokenData';
import { formatAddressStart } from '../../util/FormatAddress';
import FeeTierContainer from '../common/FeeTierContainer';
import RoundedBadge from 'shared/lib/components/common/RoundedBadge';
import { Display } from 'shared/lib/components/common/Typography';

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
  width: 80px;
  height: 48px;
`;

const TokenIcon = styled.img`
  ${tw`rounded-full bg-white`}
  box-shadow: 0 0 0 3px black;
  width: 48px;
  height: 48px;
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

export type MarginAccountHeaderProps = {
  token0: TokenData;
  token1: TokenData;
  feeTier: number;
  id: string;
};

export default function MarginAccountHeader(props: MarginAccountHeaderProps) {
  return (
    <div className='flex flex-col gap-4'>
      <MarginPairContainer>
        <TokenIconsWrapper>
          <TokenIcon src={props.token0.iconPath} alt={props.token0.name} />
          <TokenIcon src={props.token1.iconPath} alt={props.token1.name} />
        </TokenIconsWrapper>
        <div className='flex justify-center items-center gap-4'>
          <div className='flex flex-col'>
            <Display size='L' weight='semibold'>
              {props.token0.ticker}
            </Display>
          </div>
          <Dash />
          <div className='flex flex-col'>
            <Display size='L' weight='semibold'>
              {props.token1.ticker}
            </Display>
          </div>
        </div>
      </MarginPairContainer>
      <MarginAccountBadges>
        <FeeTierContainer feeTier={props.feeTier} />
        <RoundedBadge title={props.id}>ID - {formatAddressStart(props.id)}</RoundedBadge>
      </MarginAccountBadges>
    </div>
  );
}
