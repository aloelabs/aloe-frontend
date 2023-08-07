import { FilledGradientButton, FilledGreyButton } from 'shared/lib/components/common/Buttons';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { formatTokenAmount, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import { tickToPrice } from '../../data/Uniswap';
import { BoostCardInfo, BoostCardType } from '../../pages/BoostPage';
import TokenPairIcons from '../common/TokenPairIcons';
import {
  InRangeBadge,
  OutOfRangeBadge,
  UniswapPositionCardContainer,
  UniswapPositionCardWrapper,
} from '../common/UniswapPositionCard';
import LiquidityChart from './LiquidityChart';

export const ACCENT_COLOR = 'rgba(130, 160, 182, 1)';

const CustomUniswapPositionCardContainer = styled(UniswapPositionCardContainer)`
  width: 300px;
`;

export type UniswapPositionCardProps = {
  info: BoostCardInfo;
  uniqueId: string;
  isDisplayOnly?: boolean;
  setSelectedPosition?: (uniqueId: number | null) => void;
};

export default function BoostCard(props: UniswapPositionCardProps) {
  const { info, uniqueId, isDisplayOnly, setSelectedPosition } = props;
  const { token0, token1 } = info;

  const editButton =
    info.cardType === BoostCardType.UNISWAP_NFT ? (
      <FilledGradientButton size='S' onClick={() => {}}>
        Lever Up
      </FilledGradientButton>
    ) : (
      <FilledGreyButton
        size='S'
        onClick={() => {
          setSelectedPosition?.(parseInt(uniqueId));
        }}
      >
        Manage
      </FilledGreyButton>
    );

  const minPrice = tickToPrice(info.position.lower, token0.decimals, token1.decimals, true);
  const maxPrice = tickToPrice(info.position.upper, token0.decimals, token1.decimals, true);

  return (
    <CustomUniswapPositionCardContainer>
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
                {roundPercentage(info.amount0Percent(), 1)}%
              </Display>
              <Display size='S'>{formatTokenAmount(info.amount0(), 5)}</Display>
              <Text size='XS'>{token0.symbol}</Text>
            </div>
            <div className='text-right'>
              <Display size='XS' color={ACCENT_COLOR}>
                {roundPercentage(info.amount1Percent(), 1)}%
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
          <div className='flex justify-between'>
            {info.isInRange() ? <InRangeBadge /> : <OutOfRangeBadge />}
            {!isDisplayOnly && editButton}
          </div>
        </div>
        <LiquidityChart
          poolAddress={info.uniswapPool}
          minTick={info.position.lower}
          maxTick={info.position.upper}
          currentTick={info.currentTick}
          color0={info.color0}
          color1={info.color1}
          uniqueId={uniqueId}
        />
      </UniswapPositionCardWrapper>
    </CustomUniswapPositionCardContainer>
  );
}
