import { useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import Pagination from 'shared/lib/components/common/Pagination';
import TokenIcon from 'shared/lib/components/common/TokenIcon';
import { Text, Display } from 'shared/lib/components/common/Typography';
import { GREY_600 } from 'shared/lib/data/constants/Colors';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import { formatTokenAmount } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import { TokenIconsWithTooltip } from '../common/TokenIconsWithTooltip';
import SupplyModal from './modal/SupplyModal';
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
  cursor: pointer;
  &:hover {
    background-color: rgba(130, 160, 182, 0.1);
  }
`;

export type SupplyTableRow = {
  asset: Token;
  kitty: Kitty;
  collateralAssets: Token[];
  apy: number;
  supplyBalance: number;
  supplyBalanceUsd: number;
  isOptimized: boolean;
};

export type SupplyTableProps = {
  rows: SupplyTableRow[];
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function SupplyTable(props: SupplyTableProps) {
  const { rows, setPendingTxn } = props;
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<SupplyTableRow | null>(null);
  const pages: SupplyTableRow[][] = useMemo(() => {
    const pages: SupplyTableRow[][] = [];
    for (let i = 0; i < rows.length; i += PAGE_SIZE) {
      pages.push(rows.slice(i, i + PAGE_SIZE));
    }
    return pages;
  }, [rows]);
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
                <Text size='M' weight='bold'>
                  APY
                </Text>
              </th>
              <th className='px-4 py-2 text-end whitespace-nowrap'>
                <Text size='M' weight='bold'>
                  Balance
                </Text>
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
              <HoverableRow
                key={index}
                onClick={() => {
                  setSelectedRow(row);
                }}
              >
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
                  <Display size='XS'>${row.supplyBalanceUsd.toFixed(2)}</Display>
                  <Display size='XXS' color='rgba(130, 160, 182, 1)'>
                    {formatTokenAmount(row.supplyBalance)} {row.asset.symbol}
                  </Display>
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
      {selectedRow && (
        <SupplyModal
          isOpen={true}
          selectedRow={selectedRow}
          setIsOpen={() => {
            setSelectedRow(null);
          }}
          setPendingTxn={setPendingTxn}
        />
      )}
    </>
  );
}
