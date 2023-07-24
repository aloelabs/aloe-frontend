import TokenIcon from 'shared/lib/components/common/TokenIcon';
import { Text, Display } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { formatTokenAmount } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

const TableContainer = styled.div`
  width: 30%;
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
              <Text size='M' weight='bold'>
                Asset
              </Text>
            </th>
            <th className='px-4 py-2 text-end'>
              <Text size='M' weight='bold'>
                Balance
              </Text>
            </th>
          </tr>
        </TableHeader>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td className='px-4 py-2 text-start whitespace-nowrap'>
                <div className='flex items-center gap-2'>
                  <TokenIcon token={row.asset} />
                  <Display size='XS'>{row.asset.symbol}</Display>
                </div>
              </td>
              <td className='px-4 py-2 text-end whitespace-nowrap'>
                <Display size='XS'>${row.balanceUsd.toFixed(2)}</Display>
                <Display size='XXS' color='rgba(130, 160, 182, 1)'>
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
