import React from 'react';
import styled from 'styled-components';
import { TokenData } from '../../data/TokenData';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { roundPercentage } from '../../util/Numbers';
import LendTokenInfo from './LendTokenInfo';
import {
  BodyDivider,
  BodySubContainer,
  CardBodyWrapper,
  CardSubTitleWrapper,
  CardTitleWrapper,
  CardWrapper,
  ValueText,
} from '../common/Card';
import YieldTokenIcons from './YieldTokenIcons';
import tw from 'twin.macro';

const TOKEN_APY_BG_COLOR = 'rgb(29, 41, 53)';
const YIELD_AGGREGATOR_LABEL_TEXT_COLOR = 'rgba(204, 223, 237, 1)';
const BACKGROUND_GRADIENT =
  'linear-gradient(90deg, rgba(43, 43, 43, 1) 0%, rgba(97, 99, 101, 1) 100%)';
const BORDER_GRADIENT =
  'linear-gradient(90deg, rgb(122, 122, 122) 0%, rgb(170, 170, 170) 100%)';
const SHADOW_COLOR = 'rgba(0, 0, 0, 0.1)';

const YieldAggregatorLabelWrapper = styled.div`
  ${tw`flex flex-col items-center justify-center`}
  padding: 8px 16px;
  height: 36px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 100px;
`;

const TokenAPYWrapper = styled.div`
  padding: 2px 8px;
  border-radius: 8px;
  background-color: ${TOKEN_APY_BG_COLOR};
`;

export type YieldAggregatorCardProps = {
  tokens: TokenData[];
  totalAPY: number;
  totalSupply: number;
  totalUtilization: number;
};

export default function YieldAggregatorCard(props: YieldAggregatorCardProps) {
  const { tokens, totalAPY, totalSupply, totalUtilization } = props;
  return (
    <CardWrapper borderGradient={BORDER_GRADIENT} shadowColor={SHADOW_COLOR}>
      <CardTitleWrapper backgroundGradient={BACKGROUND_GRADIENT}>
        <Display size='M' weight='semibold'>
          WETH
        </Display>
        <CardSubTitleWrapper>
          <YieldTokenIcons tokens={tokens} />
          <YieldAggregatorLabelWrapper>
            <Text
              size='S'
              weight='medium'
              color={YIELD_AGGREGATOR_LABEL_TEXT_COLOR}
            >
              Yield Aggregator
            </Text>
          </YieldAggregatorLabelWrapper>
        </CardSubTitleWrapper>
      </CardTitleWrapper>
      <CardBodyWrapper>
        <BodySubContainer>
          <div className='flex items-center gap-3'>
            <Text size='M' weight='medium'>
              WETH+
            </Text>
            <TokenAPYWrapper>
              <Text size='S' weight='medium'>
                {roundPercentage(totalAPY)}% APY
              </Text>
            </TokenAPYWrapper>
          </div>
          <LendTokenInfo
            totalSupply={totalSupply}
            utilization={totalUtilization}
          />
        </BodySubContainer>
        <BodyDivider />
        <BodySubContainer>
          <Text size='M' weight='medium'>
            Last Rebalance
          </Text>
          <ValueText>2 days ago</ValueText>
        </BodySubContainer>
      </CardBodyWrapper>
    </CardWrapper>
  );
}
