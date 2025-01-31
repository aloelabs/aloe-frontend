import { useEffect, useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { Tooltip } from 'react-tooltip';
import DownArrow from 'shared/lib/assets/svg/DownArrow';
import UpArrow from 'shared/lib/assets/svg/UpArrow';
import { FilledGreyButton } from 'shared/lib/components/common/Buttons';
import Pagination from 'shared/lib/components/common/Pagination';
import TokenIcon from 'shared/lib/components/common/TokenIcon';
import { Text, Display } from 'shared/lib/components/common/Typography';
import { GREY_600, GREY_700 } from 'shared/lib/data/constants/Colors';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import useChain from 'shared/lib/hooks/UseChain';
import useSortableData from 'shared/lib/hooks/UseSortableData';
import { formatTokenAmount } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { useAccount } from 'wagmi';

import { ReactComponent as InfoIcon } from '../../../assets/svg/info.svg';
import { ApyWithTooltip } from '../../common/ApyWithTooltip';
import { TokenIconsWithTooltip } from '../../common/TokenIconsWithTooltip';
import RecoverModal, { ALOE_II_BAD_DEBT_LENDERS } from '../modal/RecoverModal';
import SupplyModal from '../modal/SupplyModal';
import WithdrawModal from '../modal/WithdrawModal';
// import OptimizeButton from './OptimizeButton';

const PAGE_SIZE = 10;

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

const StyledTooltip = styled(Tooltip)`
  background-color: ${GREY_700};
  max-width: 200px;
  z-index: 10000;
  padding: 8px 12px;
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

export type SupplyTableRow = {
  asset: Token;
  kitty: Kitty;
  collateralAssets: Token[];
  apy: number;
  rewardsRate: number;
  totalSupply: number;
  totalSupplyUsd?: number;
  suppliedBalance: number;
  suppliedBalanceUsd?: number;
  suppliableBalance: number;
  suppliableBalanceUsd?: number;
  withdrawableBalance: number;
  isOptimized: boolean;
  lastUpdated: number;
};

export type SupplyTableProps = {
  hasAuxiliaryFunds: boolean;
  rows: SupplyTableRow[];
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function SupplyTable(props: SupplyTableProps) {
  const { hasAuxiliaryFunds, rows, setPendingTxn } = props;
  const activeChain = useChain();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<{
    row: SupplyTableRow;
    action: 'supply' | 'withdraw' | 'recover';
  } | null>(null);
  const { sortedRows, requestSort, sortConfig } = useSortableData(rows, {
    primaryKey: 'suppliedBalanceUsd',
    secondaryKey: 'totalSupplyUsd',
    direction: 'descending',
  });

  const { address: userAddress } = useAccount();

  // Reset current page when chain changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeChain]);

  const pages: SupplyTableRow[][] = useMemo(() => {
    const pages: SupplyTableRow[][] = [];
    for (let i = 0; i < sortedRows.length; i += PAGE_SIZE) {
      pages.push(sortedRows.slice(i, i + PAGE_SIZE));
    }
    return pages;
  }, [sortedRows]);

  // If there are no pages or the current page is out of bounds, return null
  if (pages.length === 0 || pages.length < currentPage) {
    return null;
  }

  return (
    <>
      <StyledTooltip
        anchorSelect='.collateral-tooltip-anchor'
        place='right'
        opacity={1.0}
        border={'1px solid #CCDFED'}
        disableStyleInjection={true}
      >
        <Text size='S' weight='regular' color='#CCDFED'>
          The supplied asset can be borrowed by posting any of these assets as collateral.
        </Text>
      </StyledTooltip>
      <StyledTooltip
        anchorSelect='.apy-tooltip-anchor'
        place='right'
        opacity={1.0}
        border={'1px solid #CCDFED'}
        disableStyleInjection={true}
      >
        <Text size='S' weight='regular' color='#CCDFED'>
          Yield is variable based on utilization. Points have no monetary value.
        </Text>
      </StyledTooltip>
      <TableContainer>
        <Table>
          <TableHeader>
            <tr>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <Text size='M' weight='bold'>
                  Asset
                </Text>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap flex items-center gap-1'>
                <Text size='M' weight='bold'>
                  Collateral
                </Text>
                <InfoIcon width={14} height={14} className='collateral-tooltip-anchor' />
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <SortButton onClick={() => requestSort('apy', sortConfig?.primaryKey)}>
                  <Text size='M' weight='bold'>
                    APY
                  </Text>
                  <InfoIcon width={14} height={14} className='apy-tooltip-anchor' />
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'apy'}
                    isSortedDesc={sortConfig?.direction === 'descending'}
                  />
                </SortButton>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <SortButton onClick={() => requestSort('totalSupplyUsd', sortConfig?.primaryKey)}>
                  <Text size='M' weight='bold'>
                    Total Supply
                  </Text>
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'totalSupplyUsd'}
                    isSortedDesc={sortConfig?.direction === 'descending'}
                  />
                </SortButton>
              </th>
              <th className='px-4 py-2 text-end whitespace-nowrap'>
                <SortButton onClick={() => requestSort('suppliableBalanceUsd', sortConfig?.primaryKey)}>
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'suppliableBalanceUsd'}
                    isSortedDesc={sortConfig?.direction === 'descending'}
                  />
                  <Text size='M' weight='bold'>
                    Wallet Balance
                  </Text>
                </SortButton>
              </th>
              <th className='px-4 py-2 text-end whitespace-nowrap'>
                <SortButton onClick={() => requestSort('suppliedBalanceUsd', sortConfig?.primaryKey)}>
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'suppliedBalanceUsd'}
                    isSortedDesc={sortConfig?.direction === 'descending'}
                  />
                  <Text size='M' weight='bold'>
                    Aloe Balance
                  </Text>
                </SortButton>
              </th>
              {/* <th className='px-4 py-2 text-center whitespace-nowrap'>
                <Text size='M' weight='bold'>
                  Optimized
                </Text>
              </th> */}
            </tr>
          </TableHeader>
          <tbody>
            {pages[currentPage - 1].map((row, index) => (
              <HoverableRow key={index}>
                <td className='px-4 py-2 text-start whitespace-nowrap'>
                  <div className='flex items-center gap-2'>
                    <TokenIcon token={row.asset} />
                    <Text size='M'>{row.asset.symbol}</Text>
                  </div>
                </td>
                <td className='px-4 py-2 text-start whitespace-nowrap'>
                  <div className='flex items-center gap-2'>
                    <TokenIconsWithTooltip tokens={row.collateralAssets} />
                  </div>
                </td>
                <td className='px-4 py-2 text-start whitespace-nowrap'>
                  <ApyWithTooltip
                    apy={row.apy}
                    // eslint-disable-next-line max-len
                    // addOn={row.totalSupplyUsd && row.rewardsRate * 86400 * 365 * Math.min(1000 / row.totalSupplyUsd, 1)}
                  />
                </td>
                <td className='px-4 py-2 text-end whitespace-nowrap'>
                  <div className='text-start'>
                    <Display size='XS'>
                      {formatTokenAmount(row.totalSupply)}&nbsp;&nbsp;{row.asset.symbol}
                    </Display>
                  </div>
                </td>
                <td className='px-4 py-2 text-end whitespace-nowrap'>
                  <div className='flex justify-end gap-4'>
                    <div className='text-end'>
                      <Display size='XS'>${row.suppliableBalanceUsd?.toFixed(2) ?? '－'}</Display>
                      <Display size='XXS' color='rgba(130, 160, 182, 1)'>
                        {formatTokenAmount(row.suppliableBalance)}&nbsp;&nbsp;{row.asset.symbol}
                      </Display>
                    </div>
                    <FilledGreyButton
                      size='S'
                      onClick={() => {
                        if (userAddress) setSelectedRow({ row, action: 'supply' });
                      }}
                      disabled={
                        true /* NOTE: disabled for wind-down */ ||
                        (userAddress &&
                          row.suppliableBalance === 0 &&
                          !(hasAuxiliaryFunds && row.asset.symbol === 'WETH')) ||
                        // TODO: move to constants
                        row.collateralAssets.some(
                          (token) => token.address === '0xba5e6fa2f33f3955f0cef50c63dcc84861eab663'
                        )
                      }
                      className='connect-wallet-button-trigger'
                    >
                      Supply
                    </FilledGreyButton>
                  </div>
                </td>
                <td className='px-4 py-2 text-end whitespace-nowrap'>
                  <div className='flex justify-end gap-4'>
                    <div className='text-end'>
                      <Display size='XS'>${row.suppliedBalanceUsd?.toFixed(2) ?? '－'}</Display>
                      <Display size='XXS' color='rgba(130, 160, 182, 1)'>
                        {formatTokenAmount(row.suppliedBalance)}&nbsp;&nbsp;{row.asset.symbol}
                      </Display>
                    </div>
                    <FilledGreyButton
                      size='S'
                      onClick={() => {
                        const hasBadDebt =
                          row.suppliedBalance > row.withdrawableBalance &&
                          ALOE_II_BAD_DEBT_LENDERS[activeChain.id]?.includes(row.kitty.address.toLowerCase());
                        setSelectedRow({ row, action: hasBadDebt ? 'recover' : 'withdraw' });
                      }}
                      disabled={row.suppliedBalance === 0}
                    >
                      Withdraw
                    </FilledGreyButton>
                  </div>
                </td>
                {/* <td className='px-4 py-2 flex justify-center whitespace-nowrap'>
                  <OptimizeButton
                    isOptimized={row.isOptimized}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  />
                </td> */}
              </HoverableRow>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className='px-4 py-2' colSpan={6}>
                <Pagination
                  currentPage={currentPage}
                  itemsPerPage={10}
                  totalItems={rows.length}
                  loading={false}
                  onPageChange={(page) => setCurrentPage(page)}
                />
              </td>
            </tr>
          </tfoot>
        </Table>
      </TableContainer>
      {selectedRow?.action === 'supply' && (
        <SupplyModal
          hasAuxiliaryFunds={hasAuxiliaryFunds}
          isOpen={true}
          selectedRow={selectedRow.row}
          setIsOpen={() => setSelectedRow(null)}
          setPendingTxn={setPendingTxn}
        />
      )}
      {userAddress && selectedRow?.action === 'withdraw' && (
        <WithdrawModal
          isOpen={true}
          selectedRow={selectedRow.row}
          userAddress={userAddress}
          setIsOpen={() => setSelectedRow(null)}
          setPendingTxn={setPendingTxn}
        />
      )}
      {userAddress && selectedRow?.action === 'recover' && (
        <RecoverModal
          isOpen={true}
          selectedRow={selectedRow.row}
          userAddress={userAddress}
          setIsOpen={() => setSelectedRow(null)}
          setPendingTxn={setPendingTxn}
        />
      )}
    </>
  );
}
