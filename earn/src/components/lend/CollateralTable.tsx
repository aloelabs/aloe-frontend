import { Text, Display } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { formatTokenAmount } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import TokenIcon from '../common/TokenIcon';

const TableContainer = styled.div`
  width: 25%;
  overflow-x: auto;
  border: 2px solid #ffffff;
  border-radius: 6px;
`;

const Table = styled.table`
  width: 100%;
`;

const TableHeader = styled.thead`
  border-bottom: 2px solid #ffffff;
  text-align: start;
`;

export type CollateralTableRow = {
  asset: Token;
  balance: number;
  balanceUsd: number;
};

export type CollateralTableProps = {
  rows: CollateralTableRow[];
};

export default function CollateralTable(props: CollateralTableProps) {
  const { rows } = props;
  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <tr>
            <th className='px-4 py-2 text-start'>
              <Text size='S' weight='bold'>
                Asset
              </Text>
            </th>
            <th className='px-4 py-2 text-end'>
              <Text size='S' weight='bold'>
                Balance
              </Text>
            </th>
          </tr>
        </TableHeader>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td className='px-4 py-2 text-start'>
                <div className='flex items-center gap-2'>
                  <TokenIcon token={row.asset} />
                  <Display size='S'>{row.asset.symbol}</Display>
                </div>
              </td>
              <td className='px-4 py-2 text-end'>
                <Display size='S'>${row.balanceUsd.toFixed(2)}</Display>
                <Display size='S'>
                  {formatTokenAmount(row.balance)} {row.asset.symbol}
                </Display>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableContainer>
  );
}
