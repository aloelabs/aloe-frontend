import { Fragment, useMemo, useState } from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_600, GREY_700 } from 'shared/lib/data/constants/Colors';
import { Token } from 'shared/lib/data/Token';
import { formatTokenAmount, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import { computeLTV } from '../../data/BalanceSheet';
import { LendingPair } from '../../data/LendingPair';
import { MarginAccount } from '../../data/MarginAccount';
import { rgba } from '../../util/Colors';
import BorrowModal from './modal/BorrowModal';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const SECONDARY_COLOR_LIGHT = 'rgba(130, 160, 182, 0.1)';

const CardWrapper = styled.div<{ $textAlignment: string }>`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  min-height: 200px;
  text-align: ${(props) => props.$textAlignment};
`;

const CardContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  border: 2px solid ${GREY_600};
  /* overflow: hidden; */
`;

const AvailableContainerPlaceholder = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 52px;
  padding-left: 16px;
  padding-right: 16px;
`;

const AvailableContainer = styled.div<{ $backgroundGradient?: string }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 52px;
  padding-left: 16px;
  padding-right: 16px;
  cursor: pointer;

  &:hover {
    background: ${(props) => props.$backgroundGradient || SECONDARY_COLOR_LIGHT};
  }

  &.selected {
    background: ${SECONDARY_COLOR_LIGHT};
  }
`;

const AvailableContainerConnectedLeft = styled(AvailableContainer)`
  position: relative;
  &::after {
    content: '';
    position: absolute;
    right: -10px;
    width: 10px;
    height: 10px;
    background-color: ${GREY_600};
  }
`;

const AvailableContainerConnectedRight = styled(AvailableContainer)`
  position: relative;
  &::after {
    content: '';
    position: absolute;
    left: -10px;
    width: 10px;
    height: 10px;
    background-color: ${GREY_600};
  }
`;

const CardRow = styled.div`
  &:not(:last-child) {
    border-bottom: 2px solid ${GREY_600};
  }
`;

const CardRowHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-bottom: 2px solid ${GREY_600};
`;

const ClearButton = styled.button`
  background-color: transparent;
  border: none;
  padding: 0;
  margin: 0;
  color: ${SECONDARY_COLOR};
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  cursor: pointer;

  &:disabled {
    color: ${GREY_700};
    cursor: default;
  }
`;

export type CollateralEntry = {
  asset: Token;
  balance: number;
  matchingPairs: LendingPair[];
};

export type BorrowEntry = {
  asset: Token;
  collateral: Token;
  apy: number;
  supply: number;
};

export type BorrowingWidgetProps = {
  marginAccounts: MarginAccount[] | null;
  collateralEntries: CollateralEntry[];
  borrowEntries: { [key: string]: BorrowEntry[] };
  tokenColors: Map<string, string>;
};

export default function BorrowingWidget(props: BorrowingWidgetProps) {
  const { marginAccounts, collateralEntries, borrowEntries, tokenColors } = props;

  const [selectedCollateral, setSelectedCollateral] = useState<CollateralEntry | null>(null);
  const [selectedBorrows, setSelectedBorrows] = useState<BorrowEntry[] | null>(null);
  const filteredBorrowEntries = useMemo(() => {
    if (selectedCollateral == null) {
      return borrowEntries;
    }
    return Object.entries(borrowEntries).reduce((filtered, [key, entries]) => {
      // Filter out entries that don't match the selected collateral
      const filteredEntries = entries.filter((entry) => entry.collateral.symbol === selectedCollateral.asset.symbol);
      if (filteredEntries.length > 0) {
        // Only add the entry if there are any matching pairs left
        filtered[key] = filteredEntries;
      }
      return filtered;
    }, {} as { [key: string]: BorrowEntry[] });
  }, [borrowEntries, selectedCollateral]);

  const filteredCollateralEntries = useMemo(() => {
    if (selectedBorrows == null || selectedBorrows.length === 0) {
      return collateralEntries;
    }
    return collateralEntries.filter((entry) =>
      selectedBorrows.some((borrow) => borrow.collateral.symbol === entry.asset.symbol)
    );
  }, [collateralEntries, selectedBorrows]);

  return (
    <>
      <div className='flex gap-4'>
        <CardWrapper $textAlignment='start'>
          <CardContainer>
            <CardRow>
              <CardRowHeader>
                <Text size='M' weight='bold'>
                  Active Collateral
                </Text>
              </CardRowHeader>
              <div className='flex flex-col'>
                {marginAccounts &&
                  marginAccounts.map((account) => {
                    const hasAssetsForToken0 = account.assets.token0Raw > 0;
                    const hasAssetsForToken1 = account.assets.token1Raw > 0;
                    const hasLiabilitiesForToken0 = account.liabilities.amount0 > 0;
                    const hasLiabilitiesForToken1 = account.liabilities.amount1 > 0;
                    const AvailableContainerToken0 =
                      hasAssetsForToken0 && !hasLiabilitiesForToken1
                        ? AvailableContainer
                        : AvailableContainerConnectedLeft;
                    const AvailableContainerToken1 =
                      hasAssetsForToken1 && !hasLiabilitiesForToken0
                        ? AvailableContainer
                        : AvailableContainerConnectedRight;
                    const ltvPercentage = computeLTV(account.iv, account.nSigma) * 100;
                    const token0Color = tokenColors.get(account.token0.address);
                    const token0Gradient = token0Color
                      ? `linear-gradient(90deg, ${rgba(token0Color, 0.25)} 0%, ${GREY_700} 100%)`
                      : undefined;
                    const token1Color = tokenColors.get(account.token1.address);
                    const token1Gradient = token1Color
                      ? `linear-gradient(90deg, ${rgba(token1Color, 0.25)} 0%, ${GREY_700} 100%)`
                      : undefined;
                    return (
                      // TODO: use borrowerNFT id as key
                      <Fragment key={account.uniswapPool}>
                        {hasAssetsForToken0 && (
                          <AvailableContainerToken0 $backgroundGradient={token0Gradient}>
                            <div className='flex items-end gap-1'>
                              <Display size='S'>{account.assets.token0Raw}</Display>
                              <Display size='XS'>{account.token0.symbol}</Display>
                            </div>
                            <Display size='XXS'>{roundPercentage(ltvPercentage, 3)}% LTV</Display>
                          </AvailableContainerToken0>
                        )}
                        {hasLiabilitiesForToken0 && !hasAssetsForToken1 && <AvailableContainerPlaceholder />}
                        {hasAssetsForToken1 && (
                          <AvailableContainerToken1 $backgroundGradient={token1Gradient}>
                            <div className='flex items-end gap-1'>
                              <Display size='S'>{account.assets.token1Raw}</Display>
                              <Display size='XS'>{account.token1.symbol}</Display>
                            </div>
                            <Display size='XXS'>{roundPercentage(ltvPercentage, 3)}% LTV</Display>
                          </AvailableContainerToken1>
                        )}
                        {hasLiabilitiesForToken1 && !hasAssetsForToken0 && <AvailableContainerPlaceholder />}
                      </Fragment>
                    );
                  })}
              </div>
            </CardRow>
            <CardRow>
              <CardRowHeader>
                <Text size='M' weight='bold'>
                  Available
                </Text>
                <ClearButton
                  disabled={selectedCollateral == null}
                  onClick={() => {
                    setSelectedCollateral(null);
                  }}
                >
                  Clear
                </ClearButton>
              </CardRowHeader>
              <div className='flex flex-col'>
                {filteredCollateralEntries.map((entry, index) => {
                  const minLtv = entry.matchingPairs.reduce(
                    (min, current) => Math.min(current.ltv * 100, min),
                    Infinity
                  );
                  const maxLtv = entry.matchingPairs.reduce(
                    (max, current) => Math.max(current.ltv * 100, max),
                    -Infinity
                  );
                  const roundedLtvs = [minLtv, maxLtv].map((ltv) => Math.round(ltv));
                  const areLtvsEqual = roundedLtvs[0] === roundedLtvs[1];
                  const ltvText = areLtvsEqual ? `${roundedLtvs[0]}% LTV` : `${roundedLtvs[0]}-${roundedLtvs[1]}% LTV`;
                  return (
                    <AvailableContainer
                      key={index}
                      onClick={() => {
                        setSelectedCollateral(entry);
                      }}
                      className={selectedCollateral === entry ? 'selected' : ''}
                    >
                      <div className='flex items-end gap-1'>
                        <Display size='S'>{formatTokenAmount(entry.balance)}</Display>
                        <Display size='XS'>{entry.asset.symbol}</Display>
                      </div>
                      <Display size='XXS'>{ltvText}</Display>
                    </AvailableContainer>
                  );
                })}
              </div>
            </CardRow>
          </CardContainer>
        </CardWrapper>
        <CardWrapper $textAlignment='end'>
          <CardContainer>
            <CardRow>
              <CardRowHeader>
                <Text size='M' weight='bold' className='ml-auto'>
                  Active Borrows
                </Text>
              </CardRowHeader>
              <div className='flex flex-col'>
                {marginAccounts &&
                  marginAccounts.map((account) => {
                    const hasAssetsForToken0 = account.assets.token0Raw > 0;
                    const hasAssetsForToken1 = account.assets.token1Raw > 0;
                    const hasLiabilitiesForToken0 = account.liabilities.amount0 > 0;
                    const hasLiabilitiesForToken1 = account.liabilities.amount1 > 0;
                    const token0Color = tokenColors.get(account.token0.address);
                    const token0Gradient = token0Color
                      ? `linear-gradient(90deg, ${GREY_700} 0%, ${rgba(token0Color, 0.25)} 100%)`
                      : undefined;
                    const token1Color = tokenColors.get(account.token1.address);
                    const token1Gradient = token1Color
                      ? `linear-gradient(90deg, ${GREY_700}  0%, ${rgba(token1Color, 0.25)} 100%)`
                      : undefined;
                    return (
                      // TODO: use borrowerNFT id as key
                      <Fragment key={account.uniswapPool}>
                        {hasLiabilitiesForToken0 && (
                          <AvailableContainerConnectedRight $backgroundGradient={token0Gradient}>
                            <Display size='XXS' color={SECONDARY_COLOR}>
                              3% APY
                            </Display>
                            <div className='flex items-end gap-1'>
                              <Display size='S' color={SECONDARY_COLOR}>
                                {formatTokenAmount(account.liabilities.amount0)}
                              </Display>
                              <Display size='XS' color={SECONDARY_COLOR}>
                                {account.token0.symbol}
                              </Display>
                            </div>
                          </AvailableContainerConnectedRight>
                        )}
                        {hasAssetsForToken0 && !hasLiabilitiesForToken1 && <AvailableContainerPlaceholder />}
                        {hasLiabilitiesForToken1 && (
                          <AvailableContainerConnectedRight $backgroundGradient={token1Gradient}>
                            <Display size='XXS'>3% APY</Display>
                            <div className='flex items-end gap-1'>
                              <Display size='S'>{formatTokenAmount(account.liabilities.amount1)}</Display>
                              <Display size='XS'>{account.token1.symbol}</Display>
                            </div>
                          </AvailableContainerConnectedRight>
                        )}
                        {hasAssetsForToken1 && !hasLiabilitiesForToken0 && <AvailableContainerPlaceholder />}
                      </Fragment>
                    );
                  })}
              </div>
            </CardRow>
            <CardRow>
              <CardRowHeader>
                <ClearButton
                  disabled={selectedBorrows == null}
                  onClick={() => {
                    setSelectedBorrows(null);
                  }}
                >
                  Clear
                </ClearButton>
                <Text size='M' weight='bold'>
                  Available
                </Text>
              </CardRowHeader>
              <div className='flex flex-col'>
                {Object.entries(filteredBorrowEntries).map(([key, entry]) => {
                  const minApy = entry.reduce((min, current) => (current.apy < min ? current.apy : min), Infinity);
                  const maxApy = entry.reduce((max, current) => (current.apy > max ? current.apy : max), -Infinity);
                  const roundedApys = [minApy, maxApy].map((apy) => Math.round(apy * 100) / 100);
                  const areApysEqual = roundedApys[0] === roundedApys[1];
                  const apyText = areApysEqual ? `${roundedApys[0]}% APY` : `${roundedApys[0]}-${roundedApys[1]}% APY`;
                  const isSelected =
                    selectedBorrows != null && selectedBorrows.some((borrow) => borrow.asset.symbol === key);
                  return (
                    <AvailableContainer
                      key={key}
                      className={isSelected ? 'selected' : ''}
                      onClick={() => {
                        setSelectedBorrows(entry);
                      }}
                    >
                      <Display size='XXS'>{apyText}</Display>
                      <Display size='XS'>{key}</Display>
                    </AvailableContainer>
                  );
                })}
              </div>
            </CardRow>
          </CardContainer>
        </CardWrapper>
      </div>
      {selectedBorrows != null && selectedCollateral != null && (
        <BorrowModal
          isOpen={selectedBorrows != null && selectedCollateral != null}
          selectedBorrows={selectedBorrows}
          selectedCollateral={selectedCollateral}
          setIsOpen={() => {
            setSelectedBorrows(null);
            setSelectedCollateral(null);
          }}
        />
      )}
    </>
  );
}
