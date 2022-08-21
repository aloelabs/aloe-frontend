import React from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Display, Text } from '../common/Typography';
import { ReactComponent as AloeLogo } from '../../assets/svg/aloe_capital_logo.svg';
import { ReactComponent as UniswapLogo } from '../../assets/svg/uniswap_logo.svg';
import { GetTokenData, TokenData } from '../../data/TokenData';
import { FeeTier, PrintFeeTier } from '../../data/BlendPoolMarkers';
import TokenPairIcons from '../common/TokenPairIcons';

const MarginAccountCardContainer = styled.div`
  ${tw`flex flex-col items-center justify-center gap-2`}
  width: 300px;
  padding: 12px 24px;
  border-radius: 8px;
  background-color: rgba(13, 24, 33, 1);
`;

const SvgWrapper = styled.div`
  ${tw`flex items-center justify-center`}
  width: 32px;
  height: 32px;

  svg {
    width: 32px;
    height: 32px;
  }
`;

export type MarginAccountCardProps = {
  token0: TokenData;
  token1: TokenData;
  feeTier: FeeTier;
};

export function MarginAccountCard(props: MarginAccountCardProps) {
  const { token0, token1, feeTier } = props;
  return (
    <MarginAccountCardContainer>
      <TokenPairIcons token0IconPath={token0?.iconPath || ''} token1IconPath={token1?.iconPath || ''} />
      <Display size='M' weight='semibold'>
        {token0?.ticker || ''} / {token1?.ticker || ''}
      </Display>
      <Text size='S' weight='medium'>
        {PrintFeeTier(feeTier)}
      </Text>
    </MarginAccountCardContainer>
  );
}
