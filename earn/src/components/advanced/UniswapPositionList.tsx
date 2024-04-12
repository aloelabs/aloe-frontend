import { useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import { formatTokenAmount, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import { sqrtRatioToPrice, sqrtRatioToTick } from '../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../data/BorrowerNft';
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
import ImportUniswapNFTModal from './modal/ImportUniswapNFTModal';
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
  borrower?: BorrowerNftBorrower;
  uniswapPosition?: UniswapPosition;
  withdrawableUniswapNFTs: Map<number, UniswapNFTPosition>;
  hasImportableUniswapNFT: boolean;
  setIsImportingUniswapNFT: (isImporting: boolean) => void;
  setSelectedUniswapPosition: (uniswapPosition: SelectedUniswapPosition | null) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function UniswapPositionCard(props: UniswapPositionCardProps) {
  const {
    borrower,
    uniswapPosition,
    withdrawableUniswapNFTs,
    hasImportableUniswapNFT,
    setIsImportingUniswapNFT,
    setSelectedUniswapPosition,
  } = props;

  if (!borrower || !uniswapPosition) {
    return (
      <UniswapPositionCardWrapper $color={GREY_700}>
        <Text size='S' color={ACCENT_COLOR} className='text-center'>
          Empty
        </Text>
        <div className='flex justify-center items-center mt-4'>
          <FilledGradientButton
            size='S'
            disabled={!hasImportableUniswapNFT}
            onClick={() => setIsImportingUniswapNFT(true)}
            fillWidth
          >
            Import
          </FilledGradientButton>
        </div>
      </UniswapPositionCardWrapper>
    );
  }

  const { sqrtPriceX96, token0, token1 } = borrower;

  const minPrice = uniswapPosition
    ? tickToPrice(uniswapPosition.lower, borrower.token0.decimals, borrower.token1.decimals, true)
    : 0;

  const maxPrice = uniswapPosition
    ? tickToPrice(uniswapPosition.upper, borrower.token0.decimals, borrower.token1.decimals, true)
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
    return position.lower === uniswapPosition?.lower && position.upper === uniswapPosition?.upper;
  });

  return (
    <UniswapPositionCardWrapper $color={GREY_700}>
      <div className='flex flex-col gap-4'>
        <div className='flex justify-center items-center'>
          <TokenPairIcons
            token0IconPath={borrower.token0.logoURI}
            token1IconPath={borrower.token1.logoURI}
            token0AltText={`${borrower.token0.symbol}'s icon`}
            token1AltText={`${borrower.token1.symbol}'s icon`}
          />
        </div>
        <div className='flex justify-between'>
          <div className='text-left'>
            <Display size='XS' color={ACCENT_COLOR}>
              {roundPercentage(amount0Percent, 1)}%
            </Display>
            <Display size='S'>{formatTokenAmount(amount0, 5)}</Display>
            <Text size='XS'>{borrower.token0.symbol}</Text>
          </div>
          <div className='text-right'>
            <Display size='XS' color={ACCENT_COLOR}>
              {roundPercentage(amount1Percent, 1)}%
            </Display>
            <Display size='S'>{formatTokenAmount(amount1, 5)}</Display>
            <Text size='XS'>{borrower.token1.symbol}</Text>
          </div>
        </div>
        <div className='flex justify-between'>
          <div className='text-left'>
            <Text size='S' color={ACCENT_COLOR}>
              Min Price
            </Text>
            <Display size='S'>{formatTokenAmount(minPrice, 5)}</Display>
            <Text size='XS'>
              {borrower.token1.symbol} per {borrower.token0.symbol}
            </Text>
          </div>
          <div className='text-right'>
            <Text size='S' color={ACCENT_COLOR}>
              Max Price
            </Text>
            <Display size='S'>{formatTokenAmount(maxPrice, 5)}</Display>
            <Text size='XS'>
              {borrower.token1.symbol} per {borrower.token0.symbol}
            </Text>
          </div>
        </div>
        <div className='flex justify-between'>
          {isInRange ? <InRangeBadge /> : <OutOfRangeBadge />}
          {withdrawableNFT && (
            <FilledGradientButton
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
            </FilledGradientButton>
          )}
        </div>
      </div>
    </UniswapPositionCardWrapper>
  );
}

export type UniswapPositionListProps = {
  borrower?: BorrowerNftBorrower;
  importableUniswapNFTPositions: Map<number, UniswapNFTPosition>;
  withdrawableUniswapNFTs: Map<number, UniswapNFTPosition>;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export function UniswapPositionList(props: UniswapPositionListProps) {
  const { borrower, importableUniswapNFTPositions, withdrawableUniswapNFTs, setPendingTxn } = props;
  const [selectedUniswapPosition, setSelectedUniswapPosition] = useState<SelectedUniswapPosition | null>(null);
  const [isImportingUniswapNFT, setIsImportingUniswapNFT] = useState(false);

  const defaultImportableNFTPosition =
    importableUniswapNFTPositions.size > 0 ? Array.from(importableUniswapNFTPositions.entries())[0] : null;

  return (
    <>
      <Container>
        <Text size='M'>Uniswap Positions</Text>
        <PositionList>
          {UNISWAP_POSITION_SLOTS.map((slot, index) => (
            <UniswapPositionCardContainer key={slot}>
              <Text size='S'>{slot}</Text>
              <UniswapPositionCard
                borrower={borrower}
                uniswapPosition={borrower?.assets.uniswapPositions.at(index)}
                withdrawableUniswapNFTs={withdrawableUniswapNFTs}
                hasImportableUniswapNFT={importableUniswapNFTPositions.size > 0}
                setIsImportingUniswapNFT={() => setIsImportingUniswapNFT(true)}
                setSelectedUniswapPosition={setSelectedUniswapPosition}
                setPendingTxn={props.setPendingTxn}
              />
            </UniswapPositionCardContainer>
          ))}
        </PositionList>
      </Container>
      {borrower && selectedUniswapPosition && (
        <WithdrawUniswapNFTModal
          isOpen={selectedUniswapPosition !== null}
          borrower={borrower}
          uniswapPosition={selectedUniswapPosition.uniswapPosition}
          existingUniswapPositions={borrower.assets.uniswapPositions}
          uniswapNFTPosition={selectedUniswapPosition.withdrawableNFT}
          setIsOpen={() => {
            setSelectedUniswapPosition(null);
          }}
          setPendingTxn={setPendingTxn}
        />
      )}
      {borrower && importableUniswapNFTPositions.size > 0 && defaultImportableNFTPosition && (
        <ImportUniswapNFTModal
          isOpen={isImportingUniswapNFT}
          borrower={borrower}
          uniswapNFTPositions={importableUniswapNFTPositions}
          defaultUniswapNFTPosition={defaultImportableNFTPosition}
          existingUniswapPositions={borrower.assets.uniswapPositions}
          setIsOpen={() => {
            setIsImportingUniswapNFT(false);
          }}
          setPendingTxn={setPendingTxn}
        />
      )}
    </>
  );
}
