import { useEffect, useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import JSBI from 'jsbi';
import TokenIcon from 'shared/lib/components/common/TokenIcon';
import TokenIcons from 'shared/lib/components/common/TokenIcons';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GREY_600, GREY_700 } from 'shared/lib/data/constants/Colors';
import { GetNumericFeeTier } from 'shared/lib/data/FeeTier';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import { Token } from 'shared/lib/data/Token';
import { formatTokenAmount, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { Address, Chain } from 'viem';
import { Config, useClient } from 'wagmi';

import { computeLTV } from '../../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../../data/BorrowerNft';
import { LendingPair, LendingPairBalancesMap } from '../../../data/LendingPair';
import { fetchUniswapNFTPositions, UniswapNFTPosition } from '../../../data/Uniswap';
import { rgba } from '../../../util/Colors';
import { useEthersProvider } from '../../../util/Provider';
import HealthGauge from '../../common/HealthGauge';
import BorrowModal from '../modal/BorrowModal';
import BorrowModalUniswap from '../modal/BorrowModalUniswap';
import UpdateBorrowerModal from '../modal/UpdateBorrowerModal';
import UpdateCollateralModal from '../modal/UpdateCollateralModal';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const SECONDARY_COLOR_LIGHT = 'rgba(130, 160, 182, 0.1)';

const CardWrapper = styled.div<{ $textAlignment: string }>`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
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

const AvailableContainer = styled.div<{ $gradDirection?: string; $gradColorA?: string; $gradColorB?: string }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 52px;
  padding-left: 16px;
  padding-right: 16px;
  cursor: pointer;

  @property --gradColorA {
    syntax: '<color>';
    initial-value: transparent;
    inherits: false;
  }

  @property --gradColorB {
    syntax: '<color>';
    initial-value: transparent;
    inherits: false;
  }

  background: linear-gradient(${(props) => props.$gradDirection || '45deg'}, var(--gradColorA), var(--gradColorB));

  &.active,
  &:hover {
    --gradColorA: ${(props) => props.$gradColorA || SECONDARY_COLOR_LIGHT};
    --gradColorB: ${(props) => props.$gradColorB || SECONDARY_COLOR_LIGHT};
  }

  &.selected {
    background: ${SECONDARY_COLOR_LIGHT};
  }

  transition: --gradColorA 0.33s ease-out, --gradColorB 0.33s ease-out;
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

type SelectedBorrower = {
  borrower: BorrowerNftBorrower;
  type: 'borrow' | 'supply';
};

export type BorrowingWidgetProps = {
  // Alternatively, could get these 3 from `ChainContext`, `useProvider`, and `useAccount`, respectively
  chain: Chain;
  userAddress?: Address;
  borrowers: BorrowerNftBorrower[] | null;
  lendingPairs: LendingPair[];
  uniqueTokens: Token[];
  // TODO: may be better to have the key be a full Token instead of just the address due to multichain issues
  tokenBalances: LendingPairBalancesMap;
  tokenQuotes: Map<string, number>;
  tokenColors: Map<string, string>;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

function filterBySelection(lendingPairs: LendingPair[], selection: Token | null) {
  const reverseTokenMap = new Map<Token, LendingPair[]>();

  lendingPairs.forEach((pair) => {
    const selectionIsPartOfPair = selection === null || pair.token0.equals(selection) || pair.token1.equals(selection);
    if (!selectionIsPartOfPair) return;

    if (reverseTokenMap.has(pair.token0)) reverseTokenMap.get(pair.token0)!.push(pair);
    else reverseTokenMap.set(pair.token0, [pair]);

    if (reverseTokenMap.has(pair.token1)) reverseTokenMap.get(pair.token1)!.push(pair);
    else reverseTokenMap.set(pair.token1, [pair]);
  });

  if (selection !== null) reverseTokenMap.delete(selection);
  return Array.from(reverseTokenMap.entries()).map((entry) => ({ token: entry[0], matchingPairs: entry[1] }));
}

function borrowEntriesForUniswapCollateral(lendingPairs: LendingPair[], selection: UniswapNFTPosition) {
  const pair = lendingPairs.find((x) => x.token0.equals(selection.token0) && x.token1.equals(selection.token1));

  if (pair === undefined) return [];
  return [
    { token: pair.token0, matchingPairs: [pair] },
    { token: pair.token1, matchingPairs: [pair] },
  ];
}

type Collateral = Token | UniswapNFTPosition;

function collateralIsUniswapPosition(collateral: Collateral | null): collateral is UniswapNFTPosition {
  return collateral != null && Object.hasOwn(collateral, 'liquidity');
}

export default function BorrowingWidget(props: BorrowingWidgetProps) {
  const { chain, userAddress, borrowers, lendingPairs, tokenBalances, tokenColors, setPendingTxn } = props;

  // selection/hover state for Available Table
  const [selectedCollateral, setSelectedCollateral] = useState<Collateral | null>(null);
  const [selectedBorrows, setSelectedBorrows] = useState<Token | null>(null);
  const [hoveredPair, setHoveredPair] = useState<LendingPair | null>(null);
  // selection/hover state for Active Table
  const [selectedBorrower, setSelectedBorrower] = useState<SelectedBorrower | null>(null);
  const [hoveredBorrower, setHoveredBorrower] = useState<BorrowerNftBorrower | null>(null);
  // uniswap positions
  const [uniswapPositions, setUniswapPositions] = useChainDependentState<UniswapNFTPosition[]>([], chain.id);

  const client = useClient<Config>({ chainId: chain.id });
  const provider = useEthersProvider(client);

  useEffect(() => {
    (async () => {
      if (!userAddress || !provider) return;
      const mapOfPositions = await fetchUniswapNFTPositions(userAddress, provider);
      setUniswapPositions(Array.from(mapOfPositions.values()));
    })();
  }, [userAddress, provider, setUniswapPositions]);

  const filteredCollateralEntries = useMemo(
    () => filterBySelection(lendingPairs, selectedBorrows),
    [lendingPairs, selectedBorrows]
  );

  const filteredBorrowEntries = useMemo(
    () =>
      collateralIsUniswapPosition(selectedCollateral)
        ? borrowEntriesForUniswapCollateral(lendingPairs, selectedCollateral)
        : filterBySelection(lendingPairs, selectedCollateral),
    [lendingPairs, selectedCollateral]
  );

  const filteredUniswapPositions = useMemo(
    () =>
      uniswapPositions.filter(
        (pos) =>
          JSBI.GT(pos.liquidity, '0') &&
          lendingPairs.some(
            (x) =>
              x.token0.equals(pos.token0) &&
              x.token1.equals(pos.token1) &&
              GetNumericFeeTier(x.uniswapFeeTier) === pos.fee
          ) &&
          ((selectedBorrows?.equals(pos.token0) ?? true) || (selectedBorrows?.equals(pos.token1) ?? true))
      ),
    [uniswapPositions, lendingPairs, selectedBorrows]
  );

  let borrowModal: JSX.Element | null = null;

  if (selectedBorrows != null && selectedCollateral != null) {
    if (collateralIsUniswapPosition(selectedCollateral)) {
      borrowModal = (
        <BorrowModalUniswap
          isOpen={selectedBorrows != null && selectedCollateral != null}
          selectedLendingPair={
            // TODO: improve this
            filteredBorrowEntries.find((x) => x.token.equals(selectedBorrows))!.matchingPairs[0]
          }
          selectedCollateral={selectedCollateral}
          selectedBorrow={selectedBorrows}
          setIsOpen={() => {
            setSelectedBorrows(null);
            setSelectedCollateral(null);
          }}
          setPendingTxn={setPendingTxn}
        />
      );
    } else {
      borrowModal = (
        <BorrowModal
          isOpen={selectedBorrows != null && selectedCollateral != null}
          selectedLendingPair={
            // TODO: improve this
            filteredBorrowEntries.find((x) => x.token.equals(selectedBorrows))!.matchingPairs[0]
          }
          selectedCollateral={selectedCollateral}
          selectedBorrow={selectedBorrows}
          userBalance={tokenBalances.get(selectedCollateral.address)?.gn ?? GN.zero(selectedCollateral.decimals)}
          setIsOpen={() => {
            setSelectedBorrows(null);
            setSelectedCollateral(null);
          }}
          setPendingTxn={setPendingTxn}
        />
      );
    }
  }

  const filteredBorrowers = useMemo(() => {
    return borrowers?.filter((account) => {
      return !(
        account.assets.amount0.isZero() &&
        account.assets.amount1.isZero() &&
        !account.assets.uniswapPositions.some((pos) => !JSBI.EQ(pos.liquidity, '0'))
      );
    });
  }, [borrowers]);

  return (
    <>
      {Boolean(filteredBorrowers?.length) && (
        <>
          <Text size='L' weight='bold'>
            Manage positions
          </Text>
          <div className='flex'>
            <CardWrapper $textAlignment='start'>
              <CardContainer>
                <CardRow>
                  <CardRowHeader>
                    <Text size='M' weight='bold'>
                      Collateral
                    </Text>
                  </CardRowHeader>
                  <div className='flex flex-col'>
                    {filteredBorrowers?.map((account) => {
                      const uniswapPosition = account.assets.uniswapPositions.at(0);
                      const collateral = account.assets.amount0.isGtZero() ? account.token0 : account.token1;
                      const collateralAmount = collateral.equals(account.token0)
                        ? account.assets.amount0
                        : account.assets.amount1;
                      const collateralColor = tokenColors.get(collateral.address);
                      const ltvPercentage = computeLTV(account.iv, account.nSigma) * 100;
                      return (
                        <AvailableContainer
                          $gradDirection='45deg'
                          $gradColorA={collateralColor && rgba(collateralColor, 0.25)}
                          $gradColorB={GREY_700}
                          key={account.tokenId}
                          onMouseEnter={() => setHoveredBorrower(account)}
                          onMouseLeave={() => setHoveredBorrower(null)}
                          className={account === hoveredBorrower ? 'active' : ''}
                          onClick={() =>
                            setSelectedBorrower({
                              borrower: account,
                              type: 'supply',
                            })
                          }
                        >
                          {uniswapPosition !== undefined ? (
                            <div className='flex items-center gap-3'>
                              <TokenIcons tokens={[account.token0, account.token1]} />
                              <Display size='XS'>Uniswap Position</Display>
                              <Display size='XXS' color={SECONDARY_COLOR}>
                                {uniswapPosition.lower} ⇔ {uniswapPosition.upper}
                              </Display>
                            </div>
                          ) : (
                            <div className='flex items-center gap-3'>
                              <TokenIcon token={collateral} />
                              <Display size='XS'>
                                {collateralAmount.toString(GNFormat.LOSSY_HUMAN)}&nbsp;&nbsp;{collateral.symbol}
                              </Display>
                            </div>
                          )}
                          <Display size='XXS'>{roundPercentage(ltvPercentage, 2)}%&nbsp;&nbsp;LLTV</Display>
                        </AvailableContainer>
                      );
                    })}
                  </div>
                </CardRow>
              </CardContainer>
            </CardWrapper>
            <div className='w-[52px] mt-[2px]'>
              <div className='w-[52px] h-[42px]' />
              {filteredBorrowers?.map((borrower) => {
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
                      Borrows
                    </Text>
                  </CardRowHeader>
                  <div className='flex flex-col'>
                    {filteredBorrowers?.map((account) => {
                      const isBorrowingToken0 = account.liabilities.amount0 > 0;
                      const liability = isBorrowingToken0 ? account.token0 : account.token1;
                      const liabilityAmount = isBorrowingToken0
                        ? account.liabilities.amount0
                        : account.liabilities.amount1;
                      const liabilityColor = tokenColors.get(liability.address);
                      const lendingPair = lendingPairs.find(
                        (pair) => pair.uniswapPool === account.uniswapPool.toLowerCase()
                      );
                      const apr = (lendingPair?.[isBorrowingToken0 ? 'kitty0Info' : 'kitty1Info'].borrowAPR || 0) * 100;
                      const roundedApr = Math.round(apr * 100) / 100;
                      return (
                        <AvailableContainer
                          $gradDirection='-45deg'
                          $gradColorA={liabilityColor && rgba(liabilityColor, 0.25)}
                          $gradColorB={GREY_700}
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
                          <Display size='XXS'>{roundedApr}%&nbsp;&nbsp;APR</Display>
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
              </CardContainer>
            </CardWrapper>
          </div>
        </>
      )}
      <Text size='L' weight='bold'>
        Open a new position
      </Text>
      <div className='flex'>
        <CardWrapper $textAlignment='start'>
          <CardContainer>
            <CardRow>
              <CardRowHeader>
                <Text size='M' weight='bold'>
                  Collateral
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
                {filteredUniswapPositions.map((uniswapPosition, idx) => {
                  const lendingPair = lendingPairs.find(
                    (pair) => pair.token0.equals(uniswapPosition.token0) && pair.token1.equals(uniswapPosition.token1)
                  );
                  const openSeaLink = `https://opensea.io/assets/${chain.name}/${
                    UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chain.id]
                  }/${uniswapPosition.tokenId}`;
                  return (
                    <AvailableContainer
                      key={idx}
                      onClick={() => setSelectedCollateral(uniswapPosition)}
                      onMouseEnter={() => {
                        if (selectedBorrows !== null && lendingPair) setHoveredPair(lendingPair);
                      }}
                      onMouseLeave={() => setHoveredPair(null)}
                      className={selectedCollateral === uniswapPosition ? 'selected' : ''}
                    >
                      <div className='flex items-center gap-3'>
                        <TokenIcons
                          tokens={[uniswapPosition.token0, uniswapPosition.token1]}
                          links={[openSeaLink, openSeaLink]}
                        />
                        <Display size='XS'>Uniswap Position #{uniswapPosition.tokenId}</Display>
                      </div>
                      <Display size='XXS' color='rgba(130, 160, 182, 1)'>
                        {((lendingPair?.ltv || 0) * 100).toFixed(0)}%&nbsp;&nbsp;LLTV
                      </Display>
                    </AvailableContainer>
                  );
                })}
                {filteredCollateralEntries.map((entry, index) => {
                  const isSelected = selectedCollateral === entry.token;

                  let ltvText = '';
                  if (isSelected && hoveredPair !== null) {
                    ltvText = `${Math.round(hoveredPair.ltv * 100)}%`;
                  } else {
                    let minLtv = Infinity;
                    let maxLtv = -Infinity;

                    entry.matchingPairs.forEach((pair) => {
                      minLtv = Math.min(minLtv, pair.ltv);
                      maxLtv = Math.max(maxLtv, pair.ltv);
                    });

                    const roundedLtvs = [minLtv, maxLtv].map((ltv) => Math.round(ltv * 100));
                    const areLtvsEqual = roundedLtvs[0] === roundedLtvs[1];
                    ltvText = areLtvsEqual ? `${roundedLtvs[0]}%` : `${roundedLtvs[0]}－${roundedLtvs[1]}%`;
                  }
                  const balance = tokenBalances.get(entry.token.address)?.value || 0; // TODO: could use GN

                  return (
                    <AvailableContainer
                      key={index}
                      onClick={() => setSelectedCollateral(entry.token)}
                      onMouseEnter={() => {
                        if (selectedBorrows !== null) setHoveredPair(entry.matchingPairs[0]);
                      }}
                      onMouseLeave={() => setHoveredPair(null)}
                      className={isSelected ? 'selected' : ''}
                    >
                      <div className='flex items-center gap-3'>
                        <TokenIcon token={entry.token} />
                        <Display size='XS'>
                          {formatTokenAmount(balance)}&nbsp;&nbsp;
                          {entry.token.symbol}
                        </Display>
                      </div>
                      <Display size='XXS' color='rgba(130, 160, 182, 1)'>
                        {ltvText}&nbsp;&nbsp;LLTV
                      </Display>
                    </AvailableContainer>
                  );
                })}
              </div>
            </CardRow>
          </CardContainer>
        </CardWrapper>
        <div className='w-[52px] min-w-[52px]'></div>
        <CardWrapper $textAlignment='end'>
          <CardContainer>
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
                  Borrows
                </Text>
              </CardRowHeader>
              <div className='flex flex-col'>
                {filteredBorrowEntries.map((entry) => {
                  const isSelected = selectedBorrows === entry.token;

                  let aprText = '';
                  if (isSelected && hoveredPair !== null) {
                    const pair = hoveredPair;
                    const apr = pair[entry.token.equals(pair.token0) ? 'kitty0Info' : 'kitty1Info'].borrowAPR * 100;
                    aprText = `${Math.round(apr * 100) / 100}%`;
                  } else {
                    let minApr = Infinity;
                    let maxApr = -Infinity;

                    entry.matchingPairs.forEach((pair) => {
                      const apr = pair[entry.token.equals(pair.token0) ? 'kitty0Info' : 'kitty1Info'].borrowAPR * 100;
                      minApr = Math.min(minApr, apr);
                      maxApr = Math.max(maxApr, apr);
                    });

                    const roundedAprs = [minApr, maxApr].map((apr) => Math.round(apr * 100) / 100);
                    const areAprsEqual = roundedAprs[0] === roundedAprs[1];
                    aprText = areAprsEqual ? `${roundedAprs[0]}%` : `${roundedAprs[0]}－${roundedAprs[1]}%`;
                  }

                  return (
                    <AvailableContainer
                      key={entry.token.address + entry.token.chainId.toString()}
                      className={isSelected ? 'selected' : ''}
                      onClick={() => setSelectedBorrows(entry.token)}
                      onMouseEnter={() => {
                        if (selectedCollateral !== null) setHoveredPair(entry.matchingPairs[0]);
                      }}
                      onMouseLeave={() => setHoveredPair(null)}
                    >
                      <Display size='XXS' color='rgba(130, 160, 182, 1)'>
                        {aprText}&nbsp;&nbsp;APR
                      </Display>
                      <div className='flex items-center gap-3'>
                        <Display size='XS'>{entry.token.symbol}</Display>
                        <TokenIcon token={entry.token} />
                      </div>
                    </AvailableContainer>
                  );
                })}
              </div>
            </CardRow>
          </CardContainer>
        </CardWrapper>
      </div>
      {borrowModal}
      {selectedBorrower != null && selectedBorrower.type === 'borrow' && (
        <UpdateBorrowerModal
          isOpen={selectedBorrower != null}
          borrower={selectedBorrower.borrower}
          lendingPair={lendingPairs.find(
            (pair) => pair.uniswapPool === selectedBorrower.borrower.uniswapPool.toLowerCase()
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
          uniswapPositions={uniswapPositions}
          setIsOpen={() => {
            setSelectedBorrower(null);
          }}
          setPendingTxn={setPendingTxn}
        />
      )}
    </>
  );
}
