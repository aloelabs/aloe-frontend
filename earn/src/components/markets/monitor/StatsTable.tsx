import { useMemo } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { Tooltip } from 'react-tooltip';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import DownArrow from 'shared/lib/assets/svg/DownArrow';
import OpenIcon from 'shared/lib/assets/svg/OpenNoPad';
import UpArrow from 'shared/lib/assets/svg/UpArrow';
import { FilledGreyButton } from 'shared/lib/components/common/Buttons';
import Pagination from 'shared/lib/components/common/Pagination';
import TokenIcons from 'shared/lib/components/common/TokenIcons';
import { Text, Display } from 'shared/lib/components/common/Typography';
import { ALOE_II_FACTORY_ADDRESS, ALOE_II_ORACLE_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GREY_600, GREY_700 } from 'shared/lib/data/constants/Colors';
import { Q32 } from 'shared/lib/data/constants/Values';
import { PrintFeeTier } from 'shared/lib/data/FeeTier';
import { GNFormat } from 'shared/lib/data/GoodNumber';
import { LendingPair } from 'shared/lib/data/LendingPair';
import useChain from 'shared/lib/hooks/UseChain';
import { useChainDependentState } from 'shared/lib/hooks/UseChainDependentState';
import useSortableData from 'shared/lib/hooks/UseSortableData';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';
import { roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { Address } from 'viem';
import { useWriteContract } from 'wagmi';

import { ReactComponent as InfoIcon } from '../../../assets/svg/info.svg';

const PAGE_SIZE = 5;
const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const GREEN_COLOR = 'rgba(0, 189, 63, 1)';
const YELLOW_COLOR = 'rgba(242, 201, 76, 1)';
const RED_COLOR = 'rgba(234, 87, 87, 0.75)';

const EXPLANATORY_TOOLTIPS = {
  ante: {
    tag: 'GOVERNABLE',
    text: 'The amount of ETH each borrower must deposit before borrowing. Intended to cover liquidation gas costs.',
  },
  sigma: {
    tag: 'GOVERNABLE',
    // eslint-disable-next-line max-len
    text: 'A scaling factor to apply when mapping IV to LTV. Ex: If this is 5, the market will try to adjust itself to sustain a 5σ event',
  },
  rf: {
    tag: 'GOVERNABLE',
    text: "The portion of interest that's redirected to the treasury to help cover bad debt.",
  },
  cardinality: {
    tag: 'PERMISSIONLESS INCREASE',
    text: 'The number of initialized slots in the Uniswap TWAP Oracle. Higher is better.',
  },
  guardian: {
    tag: 'PERMISSIONLESS REPORT',
    text: 'Helps monitor oracle manipulation. If threshold is exceeded, anyone can report it and pause borrows.',
  },
  ltv: {
    tag: 'PERMISSIONLESS UPDATE',
    text: 'Moves up and down based on market volatility. Updates can be triggered by anyone every 4 hours.',
  },
};

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  border: 2px solid ${GREY_600};
  border-radius: 6px;
`;

const TableHeader = styled.thead`
  border-bottom: 2px solid ${GREY_600};
  text-align: start;
`;

const SortButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const StyledDownArrow = styled(DownArrow)`
  width: 12px;
  height: 12px;

  path {
    stroke: rgba(130, 160, 182, 1);
    stroke-width: 3px;
  }
`;

const StyledUpArrow = styled(UpArrow)`
  width: 12px;
  height: 12px;

  path {
    stroke: rgba(130, 160, 182, 1);
    stroke-width: 3px;
  }
`;

const StyledTooltip = styled(Tooltip)`
  background-color: ${GREY_700};
  max-width: 200px;
  z-index: 10000;
  padding: 8px 12px;
`;

const OpenIconLink = styled.a`
  svg {
    path {
      stroke: ${SECONDARY_COLOR};
    }
  }
`;

type SortArrowProps = {
  isSorted: boolean;
  isSortedDesc: boolean;
};

function SortArrow(props: SortArrowProps) {
  const { isSorted, isSortedDesc } = props;
  if (!isSorted) {
    return null;
  }
  if (isSortedDesc) {
    return <StyledDownArrow />;
  } else {
    return <StyledUpArrow />;
  }
}

function getManipulationColor(manipulationMetric: number, manipulationThreshold: number) {
  // If the manipulation metric is greater than or equal to the threshold, the color is red.
  // If the manipulation metric is less than the threshold, but is within 20% of the threshold,
  // the color is yellow.
  // Otherwise, the color is green.
  if (manipulationMetric >= manipulationThreshold) {
    return RED_COLOR;
  } else if (manipulationMetric >= manipulationThreshold * 0.8) {
    return YELLOW_COLOR;
  } else {
    return GREEN_COLOR;
  }
}

export type StatsTableRowProps = {
  lendingPair: LendingPair;
  lastUpdatedTimestamp?: number;
  setPendingTxn: (data: WriteContractReturnType) => void;
  onMouseEnter: (pair: LendingPair | undefined) => void;
};

function StatsTableRow(props: StatsTableRowProps) {
  const { lendingPair: pair, lastUpdatedTimestamp, setPendingTxn, onMouseEnter } = props;
  const activeChain = useChain();

  const { writeContractAsync } = useWriteContract();

  const uniswapLink = `${getEtherscanUrlForChain(activeChain)}/address/${pair.uniswapPool}`;

  const manipulationMetric = pair.oracleData.manipulationMetric;
  const manipulationThreshold = pair.manipulationThreshold;
  const canBorrowingBeDisabled = manipulationMetric >= manipulationThreshold;
  const manipulationColor = getManipulationColor(manipulationMetric, manipulationThreshold);
  const manipulationInequality = manipulationMetric < manipulationThreshold ? '<' : '>';

  let lastUpdatedText = '━━━━━━━━━━';
  let canUpdateLTV: boolean | null = null;

  if (lastUpdatedTimestamp === undefined) {
    lastUpdatedText = '━━━━━━━━━━';
    canUpdateLTV = null;
  } else if (lastUpdatedTimestamp === -1) {
    lastUpdatedText = 'Updated never';
    canUpdateLTV = true;
  } else if (lastUpdatedTimestamp === 0) {
    lastUpdatedText = 'Missing update block';
    canUpdateLTV = true;
  } else {
    lastUpdatedText = `Updated ${formatDistanceToNowStrict(new Date(lastUpdatedTimestamp * 1000), {
      addSuffix: true,
      roundingMethod: 'round',
    })}`;
    const minutesSinceLastUpdate = (Date.now() / 1000 - lastUpdatedTimestamp) / 60;
    canUpdateLTV = minutesSinceLastUpdate > 240;
  }

  const pausedUntilTime = pair.factoryData.pausedUntilTime;
  const isPaused = pausedUntilTime > Date.now() / 1000;

  const lenderLinks = [pair.kitty0.address, pair.kitty1.address].map(
    (addr) => `${getEtherscanUrlForChain(activeChain)}/address/${addr}`
  );

  const reserveFactorTexts = [pair.kitty0Info.reserveFactor, pair.kitty1Info.reserveFactor].map((rf) =>
    roundPercentage(100 / rf, 2)
  );
  const reserveFactorText =
    reserveFactorTexts[0] === reserveFactorTexts[1]
      ? `${reserveFactorTexts[0]}%`
      : `${reserveFactorTexts[0]}% / ${reserveFactorTexts[1]}%`;

  return (
    <tr
      className='bg-background hover:bg-row-hover/10'
      onMouseEnter={() => onMouseEnter(pair)}
      onMouseLeave={() => onMouseEnter(undefined)}
    >
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <div className='flex items-center gap-2'>
          <TokenIcons tokens={[pair.token0, pair.token1]} links={lenderLinks} />
        </div>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <div className='flex items-center gap-2'>
          <Text size='S'>
            {pair.token0.symbol}/{pair.token1.symbol}
          </Text>
          <OpenIconLink href={uniswapLink} target='_blank' rel='noreferrer'>
            <OpenIcon width={12} height={12} />
          </OpenIconLink>
        </div>
        <Display size='XXS' color={SECONDARY_COLOR}>
          {PrintFeeTier(pair.uniswapFeeTier)}
        </Display>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <Display size='XS'>{pair.factoryData.ante.toString(GNFormat.LOSSY_HUMAN)}&nbsp;&nbsp;ETH</Display>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <Display size='XS'>{pair.factoryData.nSigma}</Display>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <Display size='XS'>{reserveFactorText}</Display>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <Display size='XS'>{pair.slot0Data.observationCardinality}</Display>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <div className='flex gap-5 justify-between'>
          <div>
            <div className='flex'>
              <Display size='XS' color={manipulationColor}>
                {manipulationMetric.toFixed(0)}
              </Display>
              <Display size='XS'>
                &nbsp;&nbsp;{manipulationInequality}&nbsp;&nbsp;{manipulationThreshold.toFixed(0)}
              </Display>
            </div>
            <Display size='XXS' color={isPaused ? RED_COLOR : SECONDARY_COLOR}>
              Borrows {isPaused ? `paused until ${format(pausedUntilTime * 1000, 'h:mmaaa')}` : 'enabled'}
            </Display>
          </div>
          {true && (
            <FilledGreyButton
              size='S'
              onClick={() =>
                writeContractAsync({
                  address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
                  abi: factoryAbi,
                  functionName: 'pause',
                  args: [pair.uniswapPool as Address, Q32],
                  chainId: activeChain.id,
                })
                  .then((hash) => setPendingTxn(hash))
                  .catch((e) => console.error(e))
              }
              disabled={!canBorrowingBeDisabled}
              backgroundColor={canBorrowingBeDisabled ? RED_COLOR : SECONDARY_COLOR}
            >
              Report
            </FilledGreyButton>
          )}
        </div>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <div className='flex gap-5 justify-between'>
          <div>
            <Display size='XS'>{(pair.ltv * 100).toFixed(0)}%</Display>
            <Display size='XXS' color={SECONDARY_COLOR}>
              {lastUpdatedText}
            </Display>
          </div>
          {true && (
            <FilledGreyButton
              size='S'
              onClick={() =>
                writeContractAsync({
                  address: ALOE_II_ORACLE_ADDRESS[activeChain.id],
                  abi: volatilityOracleAbi,
                  functionName: 'update',
                  args: [pair.uniswapPool as Address, Q32],
                  chainId: activeChain.id,
                })
                  .then((hash) => setPendingTxn(hash))
                  .catch((e) => console.error(e))
              }
              disabled={!canUpdateLTV}
            >
              Update
            </FilledGreyButton>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function StatsTable(props: { rows: StatsTableRowProps[]; chainId: number }) {
  const { rows, chainId } = props;
  const [currentPage, setCurrentPage] = useChainDependentState(1, chainId);

  // workaround to get sort data in the outermost scope
  const sortableRows = useMemo(() => {
    return rows.map((row) => ({
      ...row,
      // it's the ratio between these two that matters for oracle stability, so that's what we sort by
      sortA: row.lendingPair.oracleData.manipulationMetric / row.lendingPair.manipulationThreshold,
      sortB: row.lendingPair.ltv,
    }));
  }, [rows]);
  const { sortedRows, requestSort, sortConfig } = useSortableData(sortableRows, {
    primaryKey: 'sortA',
    secondaryKey: 'sortB',
    direction: 'descending',
  });

  const pages: StatsTableRowProps[][] = useMemo(() => {
    const pages: StatsTableRowProps[][] = [];
    for (let i = 0; i < sortedRows.length; i += PAGE_SIZE) {
      pages.push(sortedRows.slice(i, i + PAGE_SIZE));
    }
    return pages;
  }, [sortedRows]);
  if (pages.length === 0) {
    return null;
  }
  return (
    <>
      {Object.entries(EXPLANATORY_TOOLTIPS).map(([k, v]) => (
        <StyledTooltip
          key={k}
          anchorSelect={`.${k}-tooltip-anchor`}
          place='right'
          opacity={1.0}
          border={'1px solid #CCDFED'}
          disableStyleInjection={true}
        >
          <Text size='XS' weight='medium' color='white'>
            {v.tag}
          </Text>
          <Text size='S' weight='regular' color='#CCDFED'>
            {v.text}
          </Text>
        </StyledTooltip>
      ))}
      <TableContainer>
        <table className='w-full'>
          <TableHeader>
            <tr>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <Text size='M' weight='bold'>
                  Market
                </Text>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <Text size='M' weight='bold'>
                  Uniswap
                </Text>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <div className='flex items-center gap-1'>
                  <Text size='M' weight='bold'>
                    Ante
                  </Text>
                  <InfoIcon width={14} height={14} className='ante-tooltip-anchor' />
                </div>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <div className='flex items-center gap-1'>
                  <Display size='S'>σ</Display>
                  <InfoIcon width={14} height={14} className='sigma-tooltip-anchor' />
                </div>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <div className='flex items-center gap-1'>
                  <Text size='M' weight='bold'>
                    Reserve Factor
                  </Text>
                  <InfoIcon width={14} height={14} className='rf-tooltip-anchor' />
                </div>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <div className='flex items-center gap-1'>
                  <Text size='M' weight='bold'>
                    Cardinality
                  </Text>
                  <InfoIcon width={14} height={14} className='cardinality-tooltip-anchor' />
                </div>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <SortButton onClick={() => requestSort('sortA')}>
                  <Text size='M' weight='bold'>
                    Oracle Guardian
                  </Text>
                  <InfoIcon width={14} height={14} className='guardian-tooltip-anchor' />
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'sortA'}
                    isSortedDesc={sortConfig?.direction === 'descending'}
                  />
                </SortButton>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <SortButton onClick={() => requestSort('sortB')}>
                  <Text size='M' weight='bold'>
                    LTV
                  </Text>
                  <InfoIcon width={14} height={14} className='ltv-tooltip-anchor' />
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'sortB'}
                    isSortedDesc={sortConfig?.direction === 'descending'}
                  />
                </SortButton>
              </th>
            </tr>
          </TableHeader>
          <tbody>
            {pages[currentPage - 1].map((row) => (
              <StatsTableRow {...row} key={row.lendingPair.uniswapPool} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className='px-4 py-2' colSpan={8}>
                <Pagination
                  currentPage={currentPage}
                  itemsPerPage={PAGE_SIZE}
                  totalItems={rows.length}
                  loading={false}
                  onPageChange={(page) => setCurrentPage(page)}
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </TableContainer>
    </>
  );
}
