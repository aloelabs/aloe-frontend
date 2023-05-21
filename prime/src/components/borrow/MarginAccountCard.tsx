import React, { useEffect, useState } from 'react';

import { NavLink } from 'react-router-dom';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { PrintFeeTier } from 'shared/lib/data/FeeTier';
import { GNFormat } from 'shared/lib/data/GoodNumber';
import styled from 'styled-components';
import tw from 'twin.macro';

import { sumAssetsPerToken } from '../../data/BalanceSheet';
import { MarginAccountPreview } from '../../data/MarginAccount';
import { getBrighterColor, getProminentColor, rgb, rgba } from '../../util/Colors';
import { formatAddressStart } from '../../util/FormatAddress';
import { getHealthColor } from '../../util/Health';
import TokenPairIcons from '../common/TokenPairIcons';

const FEE_TIER_BG_COLOR = 'rgba(26, 41, 52, 1)';
const FEE_TIER_TEXT_COLOR = 'rgba(204, 223, 237, 1)';
const FEE_TIER_OUTLINE_COLOR = 'rgba(13, 23, 30, 1)';
const LABEL_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const CardWrapper = styled(NavLink).attrs((props: { border: string; shadow: string }) => props)`
  ${tw`flex flex-col items-start justify-evenly`}
  width: 400px;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  background-color: rgba(13, 23, 30, 1);
  border: 4px solid rgba(26, 41, 52, 1);

  &:hover {
    box-shadow: 0px 8px 48px 0px ${(props) => props.shadow};
    border-color: transparent;
    overflow: visible;
    &:before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: 16px;
      margin: -4px;
      padding: 4px;
      z-index: 5;
      background: ${(props) => props.border};
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }
  }
`;

const CardTitleWrapper = styled.div.attrs((props: { gradient: string }) => props)`
  ${tw`flex flex-col items-start justify-start`}
  padding: 32px 32px 40px 32px;
  position: relative;
  background: ${(props) => props.gradient};
  width: 100%;
`;

const CardSubTitleWrapper = styled.div`
  ${tw`flex flex-row items-center justify-between`}
  position: absolute;
  left: 0;
  bottom: -18px;
  width: calc(100% - 72px);
  height: 36px;
  margin-left: 40px;
  margin-right: 32px;
`;

const FeeTierContainer = styled.div`
  ${tw`flex flex-col items-center justify-center`}
  line-height: 20px;
  padding: 8px 16px;
  background: ${FEE_TIER_BG_COLOR};
  color: ${FEE_TIER_TEXT_COLOR};
  box-shadow: 0px 0px 0px 2px ${FEE_TIER_OUTLINE_COLOR};
  border-radius: 100px;
`;

const CardBodyWrapper = styled.div`
  ${tw`w-full flex flex-col items-start justify-start`}
  padding: 42px 32px 42px 32px;
`;

const IDContainer = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  padding: 4px 12px;
  border-top-left-radius: 8px;
  background: ${FEE_TIER_BG_COLOR};
  color: ${FEE_TIER_TEXT_COLOR};
`;

type MetricContainerProps = {
  label: string;
  value: string;
  valueColor?: string;
  valueWeight?: 'medium' | 'bold';
};

function MetricContainer(props: MetricContainerProps) {
  const { label, value, valueColor, valueWeight } = props;
  return (
    <div className='flex flex-col'>
      <Text size='M' weight='bold' color={LABEL_TEXT_COLOR}>
        {label}
      </Text>
      <Text size='L' weight={valueWeight ?? 'medium'} color={valueColor}>
        {value}
      </Text>
    </div>
  );
}

export type MarginAccountCardProps = MarginAccountPreview;

export function MarginAccountCard(props: MarginAccountCardProps) {
  const { address, assets, feeTier, liabilities, token0, token1, health } = props;
  const [token0Color, setToken0Color] = useState<string>('');
  const [token1Color, setToken1Color] = useState<string>('');
  const link = `/borrow/account/${address}`;
  const [assets0, assets1] = sumAssetsPerToken(assets);

  useEffect(() => {
    let mounted = true;
    const calculateProminentColors = async () => {
      const token0Color = await getProminentColor(token0.logoURI || '');
      const token1Color = await getProminentColor(token1.logoURI || '');
      if (mounted) {
        setToken0Color(token0Color);
        setToken1Color(token1Color);
      }
    };
    calculateProminentColors();
    return () => {
      mounted = false;
    };
  }, [token0, token1]);

  // Create the variables for the gradients.
  const cardTitleBackgroundGradient = `linear-gradient(90deg, ${rgba(token0Color, 0.25)} 0%, ${rgba(
    token1Color,
    0.25
  )} 100%)`;
  const cardBorderGradient = `linear-gradient(90deg, ${rgb(token0Color)} 0%, ${rgb(token1Color)} 100%)`;
  const cardShadowColor = rgba(getBrighterColor(token0Color, token1Color), 0.16);

  const accountHealthColor = getHealthColor(health);

  return (
    <CardWrapper to={link} border={cardBorderGradient} shadow={cardShadowColor}>
      <CardTitleWrapper gradient={cardTitleBackgroundGradient}>
        <Display size='M' weight='semibold'>
          {token0.symbol}-{token1.symbol}
        </Display>
        <CardSubTitleWrapper>
          <TokenPairIcons
            token0IconPath={token0.logoURI}
            token1IconPath={token1.logoURI}
            token0AltText={`${token0.name}'s Icon`}
            token1AltText={`${token1.name}'s Icon`}
          />
          <FeeTierContainer>
            <Text size='S' weight='medium'>
              Uniswap Fee Tier - {PrintFeeTier(feeTier)}
            </Text>
          </FeeTierContainer>
        </CardSubTitleWrapper>
      </CardTitleWrapper>
      <CardBodyWrapper>
        <div className='w-full flex flex-row justify-between'>
          <MetricContainer
            label={token0.symbol ?? 'Token0'}
            value={assets0.sub(liabilities.amount0).toString(GNFormat.LOSSY_HUMAN_SHORT)}
          />
          <MetricContainer
            label={token1.symbol ?? 'Token1'}
            value={assets1.sub(liabilities.amount1).toString(GNFormat.LOSSY_HUMAN_SHORT)}
          />
          <MetricContainer
            label='Health'
            value={health >= 5 ? '5+' : health.toFixed(2)}
            valueColor={accountHealthColor}
            valueWeight='bold'
          />
        </div>
        <IDContainer>
          <Text size='S' weight='medium' title={address}>
            ID - {formatAddressStart(address)}
          </Text>
        </IDContainer>
      </CardBodyWrapper>
    </CardWrapper>
  );
}
