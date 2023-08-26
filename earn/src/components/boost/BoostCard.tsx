import { Link } from 'react-router-dom';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { formatTokenAmount, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import { ReactComponent as WrenchIcon } from '../../assets/svg/wrench.svg';
import { ReactComponent as ZapIcon } from '../../assets/svg/zap.svg';
import { BoostCardInfo, BoostCardType } from '../../data/Uniboost';
import { tickToPrice } from '../../data/Uniswap';
import TokenPairIcons from '../common/TokenPairIcons';
import {
  InRangeBadge,
  OutOfRangeBadge,
  UniswapPositionCardContainer,
  UniswapPositionCardWrapper,
} from '../common/UniswapPositionCard';
import LiquidityChart from './LiquidityChart';

export const ACCENT_COLOR = 'rgba(130, 160, 182, 1)';
const BOOSTED_BACKGROUND_COLOR = 'rgb(255,217,102,0.1)';
const BOOSTED_TEXT_COLOR = 'rgb(255,217,102)';
const PLAIN_BACKGROUND_COLOR = 'rgba(150,150,150,0.1)';
const PLAIN_TEXT_COLOR = 'rgb(150,150,150)';

const CustomUniswapPositionCardContainer = styled(UniswapPositionCardContainer)`
  width: 300px;
  position: relative;
  border-radius: 8px;

  &:after {
    content: '';
    position: absolute;
    background-color: rgba(15, 23, 29, 0.5);

    width: 36px;
    height: 36px;
    top: 14px;
    right: 14px;
  }

  &:hover {
    &:after {
      content: none;
    }
  }
`;

const CardActionButton = styled(Link).attrs((props: { shouldAnimate: boolean }) => props)`
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  border-radius: 50%;
  background-color: transparent;
  border: 1px solid white;
  top: 16px;
  right: 16px;

  mask-origin: content-box;
  mask-image: linear-gradient(
    20deg,
    rgba(255, 255, 255, 0.8) 0% 33%,
    rgba(255, 255, 255, 1) 45% 55%,
    rgba(255, 255, 255, 0.8) 66% 100%
  );
  mask-size: cover;

  ${(props) => (props.shouldAnimate ? 'animation: pulse 1.2s linear infinite' : '')};
  @keyframes pulse {
    0% {
      transform: rotate(0deg);
      mask-position: 0px -16px;
    }
    35% {
      transform: rotate(0deg);
      mask-position: 0px -16px;
    }
    45% {
      transform: rotate(10deg);
      mask-position: 0px 4px;
    }
    55% {
      transform: rotate(-5deg);
      mask-position: 0px -4px;
    }
    65% {
      transform: rotate(0deg);
      mask-position: 0px 16px;
    }
    100% {
      transform: rotate(0deg);
      mask-position: 0px 16px;
    }
  }

  svg {
    padding: 8px;
    path {
      stroke: white;
      stroke-width: 1px;
      fill: white;
    }
  }

  &:disabled {
    opacity: 0.5;
  }
`;

const BoostBadgeWrapper = styled.div.attrs((props: { isBoosted: boolean }) => props)`
  display: flex;
  flex-direction: row;
  gap: 8px;
  background-color: ${(props) => (props.isBoosted ? BOOSTED_BACKGROUND_COLOR : PLAIN_BACKGROUND_COLOR)};
  align-items: center;
  width: fit-content;
  height: 28px;
  padding: 4px 8px;
  border-radius: 8px;
`;

function BoostBadge(props: { boostFactor: number | null }) {
  return (
    <BoostBadgeWrapper isBoosted={props.boostFactor !== null}>
      <Text size='S' color={props.boostFactor !== null ? BOOSTED_TEXT_COLOR : PLAIN_TEXT_COLOR}>
        {props.boostFactor !== null ? `${props.boostFactor.toFixed(1)}x Boost ⚡️` : 'No Boost'}
      </Text>
    </BoostBadgeWrapper>
  );
}

export type UniswapPositionCardProps = {
  info: BoostCardInfo;
  uniqueId: string;
  isDisplayOnly?: boolean;
};

export default function BoostCard(props: UniswapPositionCardProps) {
  const { info, uniqueId, isDisplayOnly } = props;
  const { token0, token1 } = info;

  const editButton =
    info.cardType === BoostCardType.UNISWAP_NFT ? (
      <CardActionButton to={'/boost/import'} shouldAnimate={true}>
        <ZapIcon width={32} height={32} />
      </CardActionButton>
    ) : (
      <CardActionButton to={`/boost/manage/${info.nftTokenId}`} shouldAnimate={false}>
        <WrenchIcon width={32} height={32} />
      </CardActionButton>
    );

  const minPrice = tickToPrice(info.position.lower, token0.decimals, token1.decimals, true);
  const maxPrice = tickToPrice(info.position.upper, token0.decimals, token1.decimals, true);
  const boostFactor = info.boostFactor();

  return (
    <CustomUniswapPositionCardContainer>
      {!isDisplayOnly && editButton}
      <UniswapPositionCardWrapper>
        <div className='flex flex-col gap-4'>
          <div className='flex justify-center items-center'>
            <TokenPairIcons
              token0IconPath={token0.logoURI}
              token1IconPath={token1.logoURI}
              token0AltText={`${token0.symbol}'s icon`}
              token1AltText={`${token1.symbol}'s icon`}
            />
          </div>
          <div className='flex justify-between'>
            <div className='text-left'>
              <Display size='XS' color={ACCENT_COLOR}>
                {roundPercentage(info.amount0Percent() * 100, 1)}%
              </Display>
              <Display size='S'>{formatTokenAmount(info.amount0(), 5)}</Display>
              <Text size='XS'>{token0.symbol}</Text>
            </div>
            <div className='text-right'>
              <Display size='XS' color={ACCENT_COLOR}>
                {roundPercentage(info.amount1Percent() * 100, 1)}%
              </Display>
              <Display size='S'>{formatTokenAmount(info.amount1(), 5)}</Display>
              <Text size='XS'>{token1.symbol}</Text>
            </div>
          </div>
          <div className='flex justify-between'>
            <div className='text-left'>
              <Text size='S' color={ACCENT_COLOR}>
                Min Price
              </Text>
              <Display size='S'>{formatTokenAmount(minPrice, 5)}</Display>
              <Text size='XS'>
                {token1.symbol} per {token0.symbol}
              </Text>
            </div>
            <div className='text-right'>
              <Text size='S' color={ACCENT_COLOR}>
                Max Price
              </Text>
              <Display size='S'>{formatTokenAmount(maxPrice, 5)}</Display>
              <Text size='XS'>
                {token1.symbol} per {token0.symbol}
              </Text>
            </div>
          </div>
          <div className='flex flex-col items-center gap-2 mb-2'>
            {info.isInRange() ? <InRangeBadge /> : <OutOfRangeBadge />}
            <BoostBadge boostFactor={boostFactor} />
          </div>
        </div>
        <LiquidityChart info={info} uniqueId={uniqueId} showPOI={isDisplayOnly || false} />
      </UniswapPositionCardWrapper>
    </CustomUniswapPositionCardContainer>
  );
}
