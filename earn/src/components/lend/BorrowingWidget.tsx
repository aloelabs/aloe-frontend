import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import TokenIcon from 'shared/lib/components/common/TokenIcon';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_600, GREY_700 } from 'shared/lib/data/constants/Colors';
import useSafeState from 'shared/lib/data/hooks/UseSafeState';
import { Token } from 'shared/lib/data/Token';
import { formatTokenAmount, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { useProvider } from 'wagmi';

import { ChainContext } from '../../App';
import { computeLTV } from '../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../data/BorrowerNft';
import { LendingPair } from '../../data/LendingPair';
import { fetchMarketInfos, MarketInfo } from '../../data/MarketInfo';
import { rgba } from '../../util/Colors';
import HealthGauge from '../common/HealthGauge';
import BorrowModal from './modal/BorrowModal';
import UpdateBorrowerModal from './modal/UpdateBorrowerModal';
import UpdateCollateralModal from './modal/UpdateCollateralModal';

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
  overflow: hidden;
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

  &.active,
  &:hover {
    background: ${(props) => props.$backgroundGradient || SECONDARY_COLOR_LIGHT};
  }

  &.selected {
    background: ${SECONDARY_COLOR_LIGHT};
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
  padding: 0.5rem 1rem;
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
  totalSupply: number;
};

type SelectedBorrower = {
  borrower: BorrowerNftBorrower;
  type: 'borrow' | 'supply';
};

export type BorrowingWidgetProps = {
  borrowers: BorrowerNftBorrower[] | null;
  collateralEntries: CollateralEntry[];
  borrowEntries: { [key: string]: BorrowEntry[] };
  tokenColors: Map<string, string>;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function BorrowingWidget(props: BorrowingWidgetProps) {
  const { borrowers, collateralEntries, borrowEntries, tokenColors, setPendingTxn } = props;

  const [selectedCollateral, setSelectedCollateral] = useState<CollateralEntry | null>(null);
  const [selectedBorrows, setSelectedBorrows] = useState<BorrowEntry[] | null>(null);
  const [selectedBorrower, setSelectedBorrower] = useState<SelectedBorrower | null>(null);
  const [hoveredBorrower, setHoveredBorrower] = useState<BorrowerNftBorrower | null>(null);
  const [marketInfos, setMarketInfos] = useSafeState<Map<string, MarketInfo>>(new Map());

  const { activeChain } = useContext(ChainContext);
  const provider = useProvider();

  // Fetch market infos for all borrowers
  useEffect(() => {
    (async () => {
      const markets =
        borrowers?.map((borrower) => {
          return {
            lender0: borrower.lender0,
            lender1: borrower.lender1,
            token0Decimals: borrower.token0.decimals,
            token1Decimals: borrower.token1.decimals,
          };
        }) ?? [];
      const uniqueMarkets = markets?.filter((market, index) => {
        return markets.findIndex((m) => m.lender0 === market.lender0 && m.lender1 === market.lender1) === index;
      });
      const marketInfosData = await fetchMarketInfos(uniqueMarkets, activeChain.id, provider);
      const marketInfosMapped = marketInfosData.reduce((acc, marketInfo) => {
        acc.set(`${marketInfo.lender0.toLowerCase()}-${marketInfo.lender1.toLowerCase()}`, marketInfo);
        return acc;
      }, new Map<string, MarketInfo>());
      setMarketInfos(marketInfosMapped);
    })();
  }, [borrowers, activeChain.id, provider, setMarketInfos]);

  const filteredBorrowEntries = useMemo(() => {
    if (selectedCollateral == null) {
      return borrowEntries;
    }
    return Object.entries(borrowEntries).reduce((filtered, [key, entries]) => {
      // Filter out entries that don't match the selected collateral
      const filteredEntries = entries.filter((entry) => entry.collateral.equals(selectedCollateral.asset));
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
    return collateralEntries.filter((entry) => selectedBorrows.some((borrow) => borrow.collateral.equals(entry.asset)));
  }, [collateralEntries, selectedBorrows]);

  return (
    <>
      <div className='flex'>
        <CardWrapper $textAlignment='start'>
          <CardContainer>
            <CardRow>
              <CardRowHeader>
                <Text size='M' weight='bold'>
                  Active Collateral
                </Text>
              </CardRowHeader>
              <div className='flex flex-col'>
                {borrowers &&
                  borrowers.map((account) => {
                    const hasNoCollateral = account.assets.token0Raw === 0 && account.assets.token1Raw === 0;
                    if (hasNoCollateral) return null;
                    const collateral = account.assets.token0Raw > 0 ? account.token0 : account.token1;
                    const collateralAmount = collateral.equals(account.token0)
                      ? account.assets.token0Raw
                      : account.assets.token1Raw;
                    const collateralColor = tokenColors.get(collateral.address);
                    const collateralGradient = collateralColor
                      ? `linear-gradient(90deg, ${rgba(collateralColor, 0.25)} 0%, ${GREY_700} 100%)`
                      : undefined;
                    const ltvPercentage = computeLTV(account.iv, account.nSigma) * 100;
                    return (
                      <AvailableContainer
                        $backgroundGradient={collateralGradient}
                        key={account.tokenId}
                        onMouseEnter={() => {
                          setHoveredBorrower(account);
                        }}
                        onMouseLeave={() => {
                          setHoveredBorrower(null);
                        }}
                        className={account === hoveredBorrower ? 'active' : ''}
                        onClick={() => {
                          setSelectedBorrower({
                            borrower: account,
                            type: 'supply',
                          });
                        }}
                      >
                        <div className='flex items-center gap-3'>
                          <TokenIcon token={collateral} />
                          <Display size='XS'>
                            {formatTokenAmount(collateralAmount)}&nbsp;&nbsp;{collateral.symbol}
                          </Display>
                        </div>
                        <Display size='XXS'>{roundPercentage(ltvPercentage, 3)}% LTV</Display>
                      </AvailableContainer>
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
                      <div className='flex items-center gap-3'>
                        <TokenIcon token={entry.asset} />
                        <Display size='XS'>
                          {formatTokenAmount(entry.balance)}&nbsp;&nbsp;{entry.asset.symbol}
                        </Display>
                      </div>
                      <Display size='XXS'>{ltvText}</Display>
                    </AvailableContainer>
                  );
                })}
              </div>
            </CardRow>
          </CardContainer>
        </CardWrapper>
        <div className='w-[52px] mt-[2px]'>
          <div className='w-[52px] h-[42px]' />
          {borrowers &&
            borrowers.map((borrower) => {
              const hasNoCollateral = borrower.assets.token0Raw === 0 && borrower.assets.token1Raw === 0;
              if (hasNoCollateral) return null;
              return (
                <div className='flex justify-center items-center w-[52px] h-[52px]' key={borrower.tokenId}>
                  <HealthGauge health={borrower.health} size={36} />
                </div>
              );
            })}
        </div>
        <CardWrapper $textAlignment='end'>
          <CardContainer>
            <CardRow>
              <CardRowHeader>
                <Text size='M' weight='bold' className='ml-auto'>
                  Active Borrows
                </Text>
              </CardRowHeader>
              <div className='flex flex-col'>
                {borrowers &&
                  borrowers.map((account) => {
                    const hasNoCollateral = account.assets.token0Raw === 0 && account.assets.token1Raw === 0;
                    if (hasNoCollateral) return null;
                    const collateral = account.assets.token0Raw > 0 ? account.token0 : account.token1;
                    const isBorrowingToken0 = !collateral.equals(account.token0);
                    const liability = isBorrowingToken0 ? account.token0 : account.token1;
                    const liabilityAmount = isBorrowingToken0
                      ? account.liabilities.amount0
                      : account.liabilities.amount1;
                    const liabilityColor = tokenColors.get(liability.address);
                    const liabilityGradient = liabilityColor
                      ? `linear-gradient(90deg, ${rgba(liabilityColor, 0.25)} 0%, ${GREY_700} 100%)`
                      : undefined;
                    const marketInfo = marketInfos.get(
                      `${account.lender0.toLowerCase()}-${account.lender1.toLowerCase()}`
                    );
                    const apy = ((isBorrowingToken0 ? marketInfo?.borrowerAPR0 : marketInfo?.borrowerAPR1) ?? 0) * 100;
                    const roundedApy = Math.round(apy * 100) / 100;
                    return (
                      <AvailableContainer
                        $backgroundGradient={liabilityGradient}
                        key={account.tokenId}
                        onMouseEnter={() => {
                          setHoveredBorrower(account);
                        }}
                        onMouseLeave={() => {
                          setHoveredBorrower(null);
                        }}
                        onClick={() => {
                          setSelectedBorrower({
                            borrower: account,
                            type: 'borrow',
                          });
                        }}
                        className={account === hoveredBorrower ? 'active' : ''}
                      >
                        <Display size='XXS'>{roundedApy}% APR</Display>
                        <div className='flex items-center gap-3'>
                          <Display size='XS'>
                            {formatTokenAmount(liabilityAmount)}&nbsp;&nbsp;{liability.symbol}
                          </Display>
                          <TokenIcon token={liability} />
                        </div>
                      </AvailableContainer>
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
                      {/* TODO: Add token logo here */}
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
          setPendingTxn={setPendingTxn}
        />
      )}
      {selectedBorrower != null && selectedBorrower.type === 'borrow' && (
        <UpdateBorrowerModal
          isOpen={selectedBorrower != null}
          borrower={selectedBorrower.borrower}
          marketInfo={marketInfos.get(
            `${selectedBorrower.borrower.lender0.toLowerCase()}-${selectedBorrower.borrower.lender1.toLowerCase()}`
          )}
          setIsOpen={() => {
            setSelectedBorrower(null);
          }}
          setPendingTxn={setPendingTxn}
        />
      )}
      {selectedBorrower != null && selectedBorrower.type === 'supply' && (
        <UpdateCollateralModal
          isOpen={selectedBorrower != null}
          borrower={selectedBorrower.borrower}
          setIsOpen={() => {
            setSelectedBorrower(null);
          }}
          setPendingTxn={setPendingTxn}
        />
      )}
    </>
  );
}
