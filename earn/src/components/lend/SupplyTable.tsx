import { useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import DownArrow from 'shared/lib/assets/svg/DownArrow';
import UpArrow from 'shared/lib/assets/svg/UpArrow';
import { FilledGreyButton } from 'shared/lib/components/common/Buttons';
import Pagination from 'shared/lib/components/common/Pagination';
import TokenIcon from 'shared/lib/components/common/TokenIcon';
import { Text, Display } from 'shared/lib/components/common/Typography';
import { GREY_600 } from 'shared/lib/data/constants/Colors';
import useSortableData from 'shared/lib/data/hooks/UseSortableData';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import { formatTokenAmount } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { useAccount } from 'wagmi';

import { TokenIconsWithTooltip } from '../common/TokenIconsWithTooltip';
import SupplyModal from './modal/SupplyModal';
import WithdrawModal from './modal/WithdrawModal';
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
  suppliedBalance: number;
  suppliedBalanceUsd: number;
  suppliableBalance: number;
  suppliableBalanceUsd: number;
  isOptimized: boolean;
};

export type SupplyTableProps = {
  rows: SupplyTableRow[];
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function SupplyTable(props: SupplyTableProps) {
  const { rows, setPendingTxn } = props;
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSupply, setSelectedSupply] = useState<SupplyTableRow | null>(null);
  const [selectedWithdraw, setSelectedWithdraw] = useState<SupplyTableRow | null>(null);
  const { sortedRows, requestSort, sortConfig } = useSortableData(rows, {
    primaryKey: 'suppliedBalanceUsd',
    secondaryKey: 'suppliableBalanceUsd',
    direction: 'descending',
  });

  const { address: userAddress } = useAccount();

  const pages: SupplyTableRow[][] = useMemo(() => {
    const pages: SupplyTableRow[][] = [];
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
                  Asset
                </Text>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <Text size='M' weight='bold'>
                  Collateral Assets
                </Text>
              </th>
              <th className='px-4 py-2 text-end whitespace-nowrap'>
                <SortButton onClick={() => requestSort('apy')}>
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'apy' ?? false}
                    isSortedDesc={sortConfig?.direction === 'descending' ?? false}
                  />
                  <Text size='M' weight='bold'>
                    APY
                  </Text>
                </SortButton>
              </th>
              <th className='px-4 py-2 text-end whitespace-nowrap'>
                <SortButton onClick={() => requestSort('suppliableBalanceUsd', 'suppliedBalanceUsd')}>
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'suppliableBalanceUsd' || false}
                    isSortedDesc={sortConfig?.direction === 'descending' || false}
                  />
                  <Text size='M' weight='bold'>
                    Wallet Balance
                  </Text>
                </SortButton>
              </th>
              <th className='px-4 py-2 text-end whitespace-nowrap'>
                <SortButton onClick={() => requestSort('suppliedBalanceUsd', 'suppliableBalanceUsd')}>
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'suppliedBalanceUsd' ?? false}
                    isSortedDesc={sortConfig?.direction === 'descending' ?? false}
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
                <td className='px-4 py-2 text-end whitespace-nowrap'>
                  <Display size='XS'>{row.apy.toFixed(2)}%</Display>
                </td>
                <td className='px-4 py-2 text-end whitespace-nowrap'>
                  <div className='flex justify-end gap-4'>
                    <div className='text-end'>
                      <Display size='XS'>${row.suppliableBalanceUsd.toFixed(2)}</Display>
                      <Display size='XXS' color='rgba(130, 160, 182, 1)'>
                        {formatTokenAmount(row.suppliableBalance)} {row.asset.symbol}
                      </Display>
                    </div>
                    <FilledGreyButton
                      size='S'
                      onClick={() => {
                        setSelectedSupply(row);
                      }}
                      disabled={row.suppliableBalance === 0}
                    >
                      Supply
                    </FilledGreyButton>
                  </div>
                </td>
                <td className='px-4 py-2 text-end whitespace-nowrap'>
                  <div className='flex justify-end gap-4'>
                    <div className='text-end'>
                      <Display size='XS'>${row.suppliedBalanceUsd.toFixed(2)}</Display>
                      <Display size='XXS' color='rgba(130, 160, 182, 1)'>
                        {formatTokenAmount(row.suppliedBalance)} {row.asset.symbol}
                      </Display>
                    </div>
                    <FilledGreyButton
                      size='S'
                      onClick={() => {
                        setSelectedWithdraw(row);
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
              <td className='px-4 py-2' colSpan={5}>
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
      {selectedSupply && (
        <SupplyModal
          isOpen={true}
          selectedRow={selectedSupply}
          setIsOpen={() => {
            setSelectedSupply(null);
          }}
          setPendingTxn={setPendingTxn}
        />
      )}
      {userAddress && selectedWithdraw && (
        <WithdrawModal
          isOpen={true}
          selectedRow={selectedWithdraw}
          userAddress={userAddress}
          setIsOpen={() => {
            setSelectedWithdraw(null);
          }}
          setPendingTxn={setPendingTxn}
        />
      )}
    </>
  );
}
