import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { FeeTier } from '../../data/FeeTier';
import { SiloData } from '../../data/SiloData';
import { TokenData } from '../../data/TokenData';
import {
  getBrighterColor,
  getProminentColor,
  rgb,
  rgba,
} from '../../util/Colors';
import FeeTierContainer from '../common/FeeTierContainer';
import InvestedTypes from '../common/InvestedTypes';
import TokenPairIcons from '../common/TokenPairIcons';
import { PercentChange } from '../common/PercentChange';
import { Display, Text } from '../common/Typography';
import { formatUSDAuto } from '../../util/Numbers';
import { BodyDivider, BodySubContainer, CardBodyWrapper, CardSubTitleWrapper, CardTitleWrapper, CardWrapper, ValueText } from '../common/Card';

const TOKEN_PAIR_FIGURE_COLOR = 'rgba(255, 255, 255, 0.6)';

export type PortfolioCardProps = {
  token0: TokenData;
  token1: TokenData;
  silo0: SiloData;
  silo1: SiloData;
  uniswapFeeTier: FeeTier;
  estimatedValue: number;
  percentageChange: number;
};

export default function PortfolioCard(props: PortfolioCardProps) {
  const {
    token0,
    token1,
    silo0,
    silo1,
    uniswapFeeTier,
    estimatedValue,
    percentageChange,
  } = props;
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
          {token0.ticker} - {token1.ticker}
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
          <Text size='M' weight='medium'>Invested</Text>
          <InvestedTypes
            token0={token0}
            token1={token1}
            silo0={silo0}
            silo1={silo1}
            figureColor={TOKEN_PAIR_FIGURE_COLOR}
          />
        </BodySubContainer>
        <BodyDivider />
        <BodySubContainer>
          <Text size='M' weight='medium'>
            Estimated Value
          </Text>
          <div className='flex gap-2 items-center'>
            <ValueText>{formatUSDAuto(estimatedValue)}</ValueText>
            <PercentChange percent={percentageChange} />
          </div>
        </BodySubContainer>
      </CardBodyWrapper>
    </CardWrapper>
  );
}
