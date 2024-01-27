import { useContext, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import DownArrow from 'shared/lib/assets/svg/DownArrow';
import OpenIcon from 'shared/lib/assets/svg/OpenNoPad';
import UnknownTokenIcon from 'shared/lib/assets/svg/tokens/unknown_token.svg';
import UpArrow from 'shared/lib/assets/svg/UpArrow';
import { FilledGreyButton } from 'shared/lib/components/common/Buttons';
import Pagination from 'shared/lib/components/common/Pagination';
import TokenIcons from 'shared/lib/components/common/TokenIcons';
import { Text, Display } from 'shared/lib/components/common/Typography';
import { ALOE_II_FACTORY_ADDRESS, ALOE_II_ORACLE_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GREY_600 } from 'shared/lib/data/constants/Colors';
import { Q32 } from 'shared/lib/data/constants/Values';
import { FeeTier, PrintFeeTier } from 'shared/lib/data/FeeTier';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import useSortableData from 'shared/lib/data/hooks/UseSortableData';
import { getTokenBySymbol } from 'shared/lib/data/TokenData';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';
import styled from 'styled-components';
import { Address, useContractWrite } from 'wagmi';

import { ChainContext } from '../../App';

const PAGE_SIZE = 20;
const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const GREEN_COLOR = 'rgba(0, 189, 63, 1)';
const YELLOW_COLOR = 'rgba(242, 201, 76, 1)';
const RED_COLOR = 'rgba(234, 87, 87, 0.75)';

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  border: 2px solid ${GREY_600};
  border-radius: 6px;
`;

const Table = styled.table`
  width: 100%;
`;

const TableHeader = styled.thead`
  border-bottom: 2px solid ${GREY_600};
  text-align: start;
`;

const HoverableRow = styled.tr`
  &:hover {
    background-color: rgba(130, 160, 182, 0.1);
  }
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
  nSigma: number;
  ltv: number;
  ante: GN;
  pausedUntilTime: number;
  manipulationMetric: number;
  manipulationThreshold: number;
  lenderSymbols: [string, string];
  lenderAddresses: [Address, Address];
  poolAddress: string;
  feeTier: FeeTier;
  lastUpdatedTimestamp?: number;
  reserveFactors: number[];
  rateModels: Address[];
  setPendingTxn: (data: SendTransactionResult) => void;
};

function StatsTableRow(props: StatsTableRowProps) {
  const {
    nSigma,
    ltv,
    ante,
    pausedUntilTime,
    manipulationMetric,
    manipulationThreshold,
    lenderSymbols,
    poolAddress,
    feeTier,
    lastUpdatedTimestamp,
    reserveFactors,
    lenderAddresses,
    setPendingTxn,
  } = props;
  const { activeChain } = useContext(ChainContext);

  const uniswapLink = `${getEtherscanUrlForChain(activeChain)}/address/${poolAddress}`;
  const token0Symbol = lenderSymbols[0].slice(0, lenderSymbols[0].length - 1);
  const token1Symbol = lenderSymbols[1].slice(0, lenderSymbols[1].length - 1);

  const manipulationColor = getManipulationColor(manipulationMetric, manipulationThreshold);
  const manipulationInequality = manipulationMetric < manipulationThreshold ? '<' : '>';

  const lastUpdated = lastUpdatedTimestamp
    ? formatDistanceToNowStrict(new Date(lastUpdatedTimestamp * 1000), { addSuffix: true, roundingMethod: 'round' })
    : 'Never';
  const minutesSinceLastUpdate = lastUpdatedTimestamp ? (Date.now() / 1000 - lastUpdatedTimestamp) / 60 : 0;
  const canUpdateLTV = minutesSinceLastUpdate > 240 || lastUpdatedTimestamp === undefined;

  const isPaused = pausedUntilTime > Date.now() / 1000;
  const canBorrowingBeDisabled = manipulationMetric >= manipulationThreshold;

  const token0 = getTokenBySymbol(activeChain.id, token0Symbol) ?? {
    name: 'Unknown Token',
    symbol: token0Symbol,
    logoURI: UnknownTokenIcon,
  };
  const token1 = getTokenBySymbol(activeChain.id, token1Symbol) ?? {
    name: 'Unknown Token',
    symbol: token1Symbol,
    logoURI: UnknownTokenIcon,
  };

  const lenderLinks = lenderAddresses.map((addr) => `${getEtherscanUrlForChain(activeChain)}/address/${addr}`);

  const { writeAsync: pause } = useContractWrite({
    address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
    abi: factoryAbi,
    functionName: 'pause',
    mode: 'recklesslyUnprepared',
    args: [poolAddress as Address, Q32],
    chainId: activeChain.id,
    onSuccess: (data: SendTransactionResult) => setPendingTxn(data),
  });

  const { writeAsync: updateLTV } = useContractWrite({
    address: ALOE_II_ORACLE_ADDRESS[activeChain.id],
    abi: volatilityOracleAbi,
    functionName: 'update',
    mode: 'recklesslyUnprepared',
    args: [poolAddress as Address, Q32],
    chainId: activeChain.id,
    onSuccess: (data: SendTransactionResult) => setPendingTxn(data),
  });

  return (
    <HoverableRow>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <div className='flex items-center gap-2'>
          <TokenIcons tokens={[token0, token1]} links={lenderLinks} />
        </div>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <div className='flex items-center gap-2'>
          <Text size='S'>
            {token0Symbol}/{token1Symbol}
          </Text>
          <OpenIconLink href={uniswapLink} target='_blank' rel='noreferrer'>
            <OpenIcon width={12} height={12} />
          </OpenIconLink>
        </div>
        <Display size='XXS' color={SECONDARY_COLOR}>
          {PrintFeeTier(feeTier)}
        </Display>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <Display size='XS'>{ante.toString(GNFormat.LOSSY_HUMAN)}&nbsp;&nbsp;ETH</Display>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <Display size='XS'>{nSigma}</Display>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <Display size='XS'>
          {reserveFactors[0]}% / {reserveFactors[1]}%
        </Display>
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
              onClick={() => pause()}
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
            <Display size='XS'>{(ltv * 100).toFixed(0)}%</Display>
            <Display size='XXS' color={SECONDARY_COLOR}>
              Updated {lastUpdated}
            </Display>
          </div>
          {true && (
            <FilledGreyButton size='S' onClick={() => updateLTV()} disabled={!canUpdateLTV}>
              Update
            </FilledGreyButton>
          )}
        </div>
      </td>
    </HoverableRow>
  );
}

export type StatsTableProps = {
  rows: StatsTableRowProps[];
};

export default function StatsTable(props: StatsTableProps) {
  const { rows } = props;
  const [currentPage, setCurrentPage] = useState(1);
  const { sortedRows, requestSort, sortConfig } = useSortableData(rows, {
    primaryKey: 'manipulationMetric',
    secondaryKey: 'ltv',
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
      <TableContainer>
        <Table>
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
                <Text size='M' weight='bold'>
                  Ante
                </Text>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <Display size='S'>σ</Display>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <Text size='M' weight='bold'>
                  Reserve Factor
                </Text>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <SortButton onClick={() => requestSort('manipulationMetric')}>
                  <Text size='M' weight='bold'>
                    Oracle Manipulation
                  </Text>
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'manipulationMetric' ?? false}
                    isSortedDesc={sortConfig?.direction === 'descending' ?? false}
                  />
                </SortButton>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <SortButton onClick={() => requestSort('ltv')}>
                  <Text size='M' weight='bold'>
                    LTV
                  </Text>
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'ltv' ?? false}
                    isSortedDesc={sortConfig?.direction === 'descending' ?? false}
                  />
                </SortButton>
              </th>
            </tr>
          </TableHeader>
          <tbody>
            {pages[currentPage - 1].map((row, index) => (
              <StatsTableRow {...row} key={row.poolAddress} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className='px-4 py-2' colSpan={7}>
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
        </Table>
      </TableContainer>
    </>
  );
}
