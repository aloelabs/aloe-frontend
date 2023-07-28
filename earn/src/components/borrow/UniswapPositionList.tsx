import { useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { FilledGreyButton } from 'shared/lib/components/common/Buttons';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { formatTokenAmount, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import { sqrtRatioToPrice, sqrtRatioToTick } from '../../data/BalanceSheet';
import { MarginAccount } from '../../data/MarginAccount';
import {
  getAmountsForLiquidity,
  tickToPrice,
  UniswapNFTPosition,
  UniswapNFTPositionEntry,
  UniswapPosition,
} from '../../data/Uniswap';
import TokenPairIcons from '../common/TokenPairIcons';
import {
  InRangeBadge,
  OutOfRangeBadge,
  UniswapPositionCardContainer,
  UniswapPositionCardWrapper,
} from '../common/UniswapPositionCard';
import { WithdrawUniswapNFTModal } from './modal/WithdrawUniswapNFTModal';

const ACCENT_COLOR = 'rgba(130, 160, 182, 1)';

const UNISWAP_POSITION_SLOTS = ['Slot A', 'Slot B', 'Slot C'];

type SelectedUniswapPosition = {
  uniswapPosition: UniswapPosition;
  withdrawableNFT: UniswapNFTPositionEntry;
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PositionList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  justify-content: space-between;
`;

type UniswapPositionCardProps = {
  marginAccount?: MarginAccount;
  uniswapPosition?: UniswapPosition;
  withdrawableUniswapNFTs: Map<number, UniswapNFTPosition>;
  setSelectedUniswapPosition: (uniswapPosition: SelectedUniswapPosition | null) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function UniswapPositionCard(props: UniswapPositionCardProps) {
  const { marginAccount, uniswapPosition, withdrawableUniswapNFTs, setSelectedUniswapPosition } = props;

  if (!marginAccount || !uniswapPosition) {
    return (
      <UniswapPositionCardWrapper>
        <Text size='S' color={ACCENT_COLOR} className='text-center'>
          Empty
        </Text>
      </UniswapPositionCardWrapper>
    );
  }

  const { sqrtPriceX96, token0, token1 } = marginAccount;

  const minPrice = uniswapPosition
    ? tickToPrice(uniswapPosition.lower, marginAccount.token0.decimals, marginAccount.token1.decimals, true)
    : 0;

  const maxPrice = uniswapPosition
    ? tickToPrice(uniswapPosition.upper, marginAccount.token0.decimals, marginAccount.token1.decimals, true)
    : 0;

  const [amount0, amount1] = uniswapPosition
    ? getAmountsForLiquidity(uniswapPosition, sqrtRatioToTick(sqrtPriceX96), token0.decimals, token1.decimals)
    : [0, 0];

  const token0PerToken1 = sqrtRatioToPrice(sqrtPriceX96, token0.decimals, token1.decimals);
  const amount0InTermsOfToken1 = amount0 * token0PerToken1;
  const totalValue = amount0InTermsOfToken1 + amount1;

  const amount0Percent = totalValue > 0 ? (amount0InTermsOfToken1 / totalValue) * 100 : 0;
  const amount1Percent = totalValue > 0 ? (amount1 / totalValue) * 100 : 0;

  const currentTick = sqrtRatioToTick(sqrtPriceX96);

  const isInRange = uniswapPosition && currentTick >= uniswapPosition.lower && currentTick <= uniswapPosition.upper;

  const withdrawableNFT = Array.from(withdrawableUniswapNFTs.entries()).find(([_, position]) => {
    return position.tickLower === uniswapPosition?.lower && position.tickUpper === uniswapPosition?.upper;
  });

  return (
    <UniswapPositionCardWrapper>
      <div className='flex flex-col gap-4'>
        <div className='flex justify-center items-center'>
          <TokenPairIcons
            token0IconPath={marginAccount.token0.logoURI}
            token1IconPath={marginAccount.token1.logoURI}
            token0AltText={`${marginAccount.token0.symbol}'s icon`}
            token1AltText={`${marginAccount.token1.symbol}'s icon`}
          />
        </div>
        <div className='flex justify-between'>
          <div className='text-left'>
            <Display size='XS' color={ACCENT_COLOR}>
              {roundPercentage(amount0Percent, 1)}%
            </Display>
            <Display size='S'>{formatTokenAmount(amount0, 5)}</Display>
            <Text size='XS'>{marginAccount.token0.symbol}</Text>
          </div>
          <div className='text-right'>
            <Display size='XS' color={ACCENT_COLOR}>
              {roundPercentage(amount1Percent, 1)}%
            </Display>
            <Display size='S'>{formatTokenAmount(amount1, 5)}</Display>
            <Text size='XS'>{marginAccount.token1.symbol}</Text>
          </div>
        </div>
        <div className='flex justify-between'>
          <div className='text-left'>
            <Text size='S' color={ACCENT_COLOR}>
              Min Price
            </Text>
            <Display size='S'>{formatTokenAmount(minPrice, 5)}</Display>
            <Text size='XS'>
              {marginAccount.token1.symbol} per {marginAccount.token0.symbol}
            </Text>
          </div>
          <div className='text-right'>
            <Text size='S' color={ACCENT_COLOR}>
              Max Price
            </Text>
            <Display size='S'>{formatTokenAmount(maxPrice, 5)}</Display>
            <Text size='XS'>
              {marginAccount.token1.symbol} per {marginAccount.token0.symbol}
            </Text>
          </div>
        </div>
        <div className='flex justify-between'>
          {isInRange ? <InRangeBadge /> : <OutOfRangeBadge />}
          {withdrawableNFT && (
            <FilledGreyButton
              size='S'
              disabled={!withdrawableNFT}
              onClick={() => {
                setSelectedUniswapPosition({
                  uniswapPosition: uniswapPosition,
                  withdrawableNFT: withdrawableNFT,
                });
              }}
            >
              Withdraw
            </FilledGreyButton>
          )}
        </div>
      </div>
    </UniswapPositionCardWrapper>
  );
}

export type UniswapPositionListProps = {
  marginAccount?: MarginAccount;
  uniswapPositions: readonly UniswapPosition[];
  withdrawableUniswapNFTs: Map<number, UniswapNFTPosition>;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export function UniswapPositionList(props: UniswapPositionListProps) {
  const { marginAccount, uniswapPositions, withdrawableUniswapNFTs, setPendingTxn } = props;
  const [selectedUniswapPosition, setSelectedUniswapPosition] = useState<SelectedUniswapPosition | null>(null);

  return (
    <>
      <Container>
        <Text size='M'>Uniswap Positions</Text>
        <PositionList>
          {UNISWAP_POSITION_SLOTS.map((slot, index) => (
            <UniswapPositionCardContainer key={slot}>
              <Text size='S'>{slot}</Text>
              <UniswapPositionCard
                marginAccount={marginAccount}
                uniswapPosition={uniswapPositions.length > index ? uniswapPositions[index] : undefined}
                withdrawableUniswapNFTs={withdrawableUniswapNFTs}
                setSelectedUniswapPosition={setSelectedUniswapPosition}
                setPendingTxn={props.setPendingTxn}
              />
            </UniswapPositionCardContainer>
          ))}
        </PositionList>
      </Container>
      {marginAccount && selectedUniswapPosition && (
        <WithdrawUniswapNFTModal
          isOpen={selectedUniswapPosition !== null}
          marginAccount={marginAccount}
          uniswapPosition={selectedUniswapPosition.uniswapPosition}
          existingUniswapPositions={uniswapPositions}
          uniswapNFTPosition={selectedUniswapPosition.withdrawableNFT}
          setIsOpen={() => {
            setSelectedUniswapPosition(null);
          }}
          setPendingTxn={setPendingTxn}
        />
      )}
    </>
  );
}
