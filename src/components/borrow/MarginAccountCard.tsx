import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { Display, Text } from '../common/Typography';
import { TokenData } from '../../data/TokenData';
import { FeeTier, PrintFeeTier } from '../../data/FeeTier';
import TokenPairIcons from '../common/TokenPairIcons';
import { NavLink } from 'react-router-dom';
import { getProminentColor, rgba } from '../../util/Colors';
import { formatUSDAuto } from '../../util/Numbers';
import { formatAddressStart } from '../../util/FormatAddress';

const FEE_TIER_BG_COLOR = 'rgba(26, 41, 52, 1)';
const FEE_TIER_TEXT_COLOR = 'rgba(204, 223, 237, 1)';
const FEE_TIER_OUTLINE_COLOR = 'rgba(13, 23, 30, 1)';
const LABEL_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const CardWrapper = styled(NavLink)`
  ${tw`flex flex-col items-start justify-evenly`}
  width: 400px;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  background-color: rgba(13, 23, 30, 1);
  border: 4px solid rgba(26, 41, 52, 1);
`;

const CardTitleWrapper = styled.div.attrs(
  (props: { gradient: string }) => props
)`
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
}

function MetricContainer(props: MetricContainerProps) {
  const { label, value } = props;
  return (
    <div className='flex flex-col'>
      <Text size='M' weight='bold' color={LABEL_TEXT_COLOR}>
        {label}
      </Text>
      <Text size='L' weight='medium'>
        {value}
      </Text>
    </div>
  );
}

export type MarginAccountCardProps = {
  token0: TokenData;
  token1: TokenData;
  feeTier: FeeTier;
  id: string;
};

export function MarginAccountCard(props: MarginAccountCardProps) {
  const { token0, token1, feeTier, id } = props;
  const [token0Color, setToken0Color] = useState<string>('');
  const [token1Color, setToken1Color] = useState<string>('');
  const link = `/borrow/account/${id}`;

  useEffect(() => {
    let mounted = true;
    const calculateProminentColors = async () => {
      const token0Color = await getProminentColor(token0.iconPath || '');
      const token1Color = await getProminentColor(token1.iconPath || '');
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
  const cardTitleBackgroundGradient = `linear-gradient(90deg, ${rgba(
    token0Color,
    0.25
  )} 0%, ${rgba(token1Color, 0.25)} 100%)`;
  
  return (
    <CardWrapper to={link}>
      <CardTitleWrapper gradient={cardTitleBackgroundGradient}>
        <Display size='M' weight='semibold'>
          {token0.ticker}-{token1.ticker}
        </Display>
        <CardSubTitleWrapper>
          <TokenPairIcons
            token0IconPath={token0.iconPath}
            token1IconPath={token1.iconPath}
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
            label='Assets'
            value={formatUSDAuto(420)}
          />
          <MetricContainer
            label='Liabilities'
            value={formatUSDAuto(69)}
          />
          <MetricContainer
            label='Health'
            value='1.20'
          />
        </div>
        <IDContainer>
          <Text size='S' weight='medium' title={id}>
            ID - {formatAddressStart(id)}
          </Text>
        </IDContainer>
      </CardBodyWrapper>
    </CardWrapper>
  );
}
