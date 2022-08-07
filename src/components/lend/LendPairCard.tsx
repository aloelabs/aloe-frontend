import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { FeeTier } from '../../data/BlendPoolMarkers';
import { TokenData } from '../../data/TokenData';
import {
  getBrighterColor,
  getProminentColor,
  rgb,
  rgba,
} from '../../util/Colors';
import FeeTierContainer from '../common/FeeTierContainer';
import TokenPairIcons from '../common/TokenPairIcons';
import { Display, Text } from '../common/Typography';
import { roundPercentage } from '../../util/Numbers';
import LendTokenInfo from './LendTokenInfo';
import {
  BodyDivider,
  BodySubContainer,
  CardBodyWrapper,
  CardSubTitleWrapper,
  CardTitleWrapper,
  CardWrapper,
} from '../common/Card';

const TOKEN_PAIR_FIGURE_COLOR = 'rgba(255, 255, 255, 0.6)';
const TOKEN_APY_BG_COLOR = 'rgb(29, 41, 53)';

const TokenAPYWrapper = styled.div`
  padding: 2px 8px;
  border-radius: 8px;
  background-color: ${TOKEN_APY_BG_COLOR};
`;

export type LendPairCardProps = {
  token0: TokenData;
  token1: TokenData;
  token0APY: number;
  token1APY: number;
  token0TotalSupply: number;
  token1TotalSupply: number;
  token0Utilization: number;
  token1Utilization: number;
  uniswapFeeTier: FeeTier;
};

export default function LendPairCard(props: LendPairCardProps) {
  const { token0, token1, token0APY, token1APY, token0TotalSupply, token1TotalSupply, token0Utilization, token1Utilization, uniswapFeeTier } =
    props;
  const [token0Color, setToken0Color] = useState<string>('');
  const [token1Color, setToken1Color] = useState<string>('');
  useEffect(() => {
    let mounted = true;
    getProminentColor(token0.iconPath || '').then((color) => {
      if (mounted) {
        setToken0Color(color);
      }
    });
    getProminentColor(token1.iconPath || '').then((color) => {
      if (mounted) {
        setToken1Color(color);
      }
    });
    return () => {
      mounted = false;
    };
  });
  // Create the variables for the gradients.
  const cardTitleBackgroundGradient = `linear-gradient(90deg, ${rgba(
    token0Color,
    0.25
  )} 0%, ${rgba(token1Color, 0.25)} 100%)`;
  const cardBorderGradient = `linear-gradient(90deg, ${rgb(
    token0Color
  )} 0%, ${rgb(token1Color)} 100%)`;
  const cardShadowColor = rgba(
    getBrighterColor(token0Color, token1Color),
    0.16
  );
  return (
    <CardWrapper
      borderGradient={cardBorderGradient}
      shadowColor={cardShadowColor}
    >
      <CardTitleWrapper backgroundGradient={cardTitleBackgroundGradient}>
        <Display size='M' weight='semibold'>
          {token0.ticker} / {token1.ticker}
        </Display>
        <CardSubTitleWrapper>
          <TokenPairIcons
            token0IconPath={token0.iconPath}
            token1IconPath={token1.iconPath}
            token0AltText={`${token0.name}'s Icon`}
            token1AltText={`${token1.name}'s Icon`}
          />
          <FeeTierContainer feeTier={uniswapFeeTier} />
        </CardSubTitleWrapper>
      </CardTitleWrapper>
      <CardBodyWrapper>
        <BodySubContainer>
          <div className='flex items-center gap-3'>
            <Text size='M' weight='medium'>
              {token0?.ticker}+
            </Text>
            <TokenAPYWrapper>
              <Text size='S' weight='medium'>
                {roundPercentage(token0APY)}% APY
              </Text>
            </TokenAPYWrapper>
          </div>
          <LendTokenInfo
            totalSupply={token0TotalSupply}
            utilization={token0Utilization}
            figureColor={TOKEN_PAIR_FIGURE_COLOR}
          />
        </BodySubContainer>
        <BodyDivider />
        <BodySubContainer>
          <div className='flex items-center gap-3'>
            <Text size='M' weight='medium'>
              {token1?.ticker}+
            </Text>
            <TokenAPYWrapper>
              <Text size='S' weight='medium'>
                {roundPercentage(token1APY)}% APY
              </Text>
            </TokenAPYWrapper>
          </div>
          <LendTokenInfo
            totalSupply={token1TotalSupply}
            utilization={token1Utilization}
            figureColor={TOKEN_PAIR_FIGURE_COLOR}
          />
        </BodySubContainer>
      </CardBodyWrapper>
    </CardWrapper>
  );
}
