import { Fragment, useMemo, useState } from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_700, GREY_800 } from 'shared/lib/data/constants/Colors';
import { Token } from 'shared/lib/data/Token';
import { formatTokenAmount, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import { ALOE_II_LIQUIDATION_INCENTIVE, ALOE_II_MAX_LEVERAGE } from '../../data/constants/Values';
import { LendingPair } from '../../data/LendingPair';
import { MarginAccount } from '../../data/MarginAccount';
import { rgba } from '../../util/Colors';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

const CardWrapper = styled.div<{ $textAlignment: string }>`
  width: 100%;
  min-height: 200px;
  text-align: ${(props) => props.$textAlignment};
`;

const CardContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  background-color: ${GREY_800};
  padding: 16px;
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
  border-radius: 8px;
  background: ${GREY_700};
  padding-left: 16px;
  padding-right: 16px;
  cursor: pointer;

  &:hover {
    background: ${(props) => props.$backgroundGradient || GREY_700};
  }

  &.selected {
    outline: 2px solid ${SECONDARY_COLOR};
  }
`;

const AvailableContainerConnectedLeft = styled(AvailableContainer)`
  position: relative;
  &::after {
    content: '';
    position: absolute;
    right: -25px;
    width: 25px;
    height: 10px;
    background-color: ${GREY_700};
  }
`;

const AvailableContainerConnectedRight = styled(AvailableContainer)`
  position: relative;
  &::after {
    content: '';
    position: absolute;
    left: -25px;
    width: 25px;
    height: 10px;
    background-color: ${GREY_700};
  }
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
    <div className='flex gap-4'>
      <CardWrapper $textAlignment='start'>
        <Text size='XL'>Collateral</Text>
        <CardContainer>
          <div>
            <Text size='S' color={SECONDARY_COLOR}>
              Active
            </Text>
            <div className='flex flex-col gap-2 mt-2'>
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
                  const fact = 1 + 1 / ALOE_II_MAX_LEVERAGE + 1 / ALOE_II_LIQUIDATION_INCENTIVE;
                  let ltv = 1 / (Math.exp((account.nSigma * account.iv) / 10) * fact);
                  ltv = Math.max(0.1, Math.min(ltv, 0.9)) * 100;
                  const token0Color = tokenColors.get(account.token0.address);
                  const token0Gradient = token0Color
                    ? `linear-gradient(90deg, ${rgba(token0Color, 0.25)} 0%, ${GREY_700} 100%)`
                    : undefined;
                  const token1Color = tokenColors.get(account.token1.address);
                  const token1Gradient = token1Color
                    ? `linear-gradient(90deg, ${rgba(token1Color, 0.25)} 0%, ${GREY_700} 100%)`
                    : undefined;
                  return (
                    <Fragment key={account.uniswapPool}>
                      {hasAssetsForToken0 && (
                        <AvailableContainerToken0 $backgroundGradient={token0Gradient}>
                          <div className='flex items-end gap-1'>
                            <Display size='S' color={SECONDARY_COLOR}>
                              {account.assets.token0Raw}
                            </Display>
                            <Display size='XS' color={SECONDARY_COLOR}>
                              {account.token0.symbol}
                            </Display>
                          </div>
                          <Display size='XXS' color={SECONDARY_COLOR}>
                            {roundPercentage(ltv, 3)}% LTV
                          </Display>
                        </AvailableContainerToken0>
                      )}
                      {hasLiabilitiesForToken0 && !hasAssetsForToken1 && <AvailableContainerPlaceholder />}
                      {hasAssetsForToken1 && (
                        <AvailableContainerToken1 $backgroundGradient={token1Gradient}>
                          <div className='flex items-end gap-1'>
                            <Display size='S' color={SECONDARY_COLOR}>
                              {account.assets.token1Raw}
                            </Display>
                            <Display size='XS' color={SECONDARY_COLOR}>
                              {account.token1.symbol}
                            </Display>
                          </div>
                          <Display size='XXS' color={SECONDARY_COLOR}>
                            {roundPercentage(ltv, 3)}% LTV
                          </Display>
                        </AvailableContainerToken1>
                      )}
                      {hasLiabilitiesForToken1 && !hasAssetsForToken0 && <AvailableContainerPlaceholder />}
                    </Fragment>
                  );
                })}
            </div>
          </div>
          <div>
            <div className='flex justify-between'>
              <Text size='S' color={SECONDARY_COLOR}>
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
            </div>
            <div className='flex flex-col gap-2 mt-2'>
              {filteredCollateralEntries.map((entry, index) => {
                const minLtv = entry.matchingPairs.reduce((min, current) => Math.min(current.ltv * 100, min), Infinity);
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
                      <Display size='S' color={SECONDARY_COLOR}>
                        {formatTokenAmount(entry.balance)}
                      </Display>
                      <Display size='XS' color={SECONDARY_COLOR}>
                        {entry.asset.symbol}
                      </Display>
                    </div>
                    <Display size='XXS' color={SECONDARY_COLOR}>
                      {ltvText}
                    </Display>
                  </AvailableContainer>
                );
              })}
            </div>
          </div>
        </CardContainer>
      </CardWrapper>
      <CardWrapper $textAlignment='end'>
        <Text size='XL'>Borrows</Text>
        <CardContainer>
          <div>
            <Text size='S' color={SECONDARY_COLOR}>
              Active
            </Text>
            <div className='flex flex-col gap-2 mt-2'>
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
                          <Display size='XXS' color={SECONDARY_COLOR}>
                            3% APY
                          </Display>
                          <div className='flex items-end gap-1'>
                            <Display size='S' color={SECONDARY_COLOR}>
                              {formatTokenAmount(account.liabilities.amount1)}
                            </Display>
                            <Display size='XS' color={SECONDARY_COLOR}>
                              {account.token1.symbol}
                            </Display>
                          </div>
                        </AvailableContainerConnectedRight>
                      )}
                      {hasAssetsForToken1 && !hasLiabilitiesForToken0 && <AvailableContainerPlaceholder />}
                    </Fragment>
                  );
                })}
            </div>
          </div>
          <div>
            <div className='flex justify-between'>
              <ClearButton
                disabled={selectedBorrows == null}
                onClick={() => {
                  setSelectedBorrows(null);
                }}
              >
                Clear
              </ClearButton>
              <Text size='S' color={SECONDARY_COLOR}>
                Available
              </Text>
            </div>
            <div className='flex flex-col gap-2 mt-2'>
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
                    <Display size='XXS' color={SECONDARY_COLOR}>
                      {apyText}
                    </Display>
                    <Display size='XS' color={SECONDARY_COLOR}>
                      {key}
                    </Display>
                  </AvailableContainer>
                );
              })}
            </div>
          </div>
        </CardContainer>
      </CardWrapper>
    </div>
  );
}
