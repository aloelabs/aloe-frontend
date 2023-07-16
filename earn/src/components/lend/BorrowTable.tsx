import { Text, Display } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { formatTokenAmount } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import TokenIcon from '../common/TokenIcon';

const HEALTH_GREEN = 'rgba(0, 193, 67, 1)';
const HEALTH_YELLOW = 'rgba(242, 201, 76, 1)';
const HEALTH_RED = 'rgba(235, 87, 87, 1)';
const HEALTH_DEFAULT = 'rgba(130, 160, 182, 1)';

const TableContainer = styled.div`
  width: 100%;
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

const HealthDot = styled.div.attrs((props: { color: string }) => props)`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${(props) => props.color};
`;

export type BorrowTableRow = {
  asset: Token;
  balance: number;
  balanceUsd: number;
  apr: number;
  health: number;
  source: string;
};

export type BorrowTableProps = {
  rows: BorrowTableRow[];
};

// TODO: Make this a shared component
function getHealthColor(health: number) {
  if (health === -1) {
    return HEALTH_DEFAULT;
  } else if (health <= 1.02) {
    return HEALTH_RED;
  } else if (health <= 1.25) {
    return HEALTH_YELLOW;
  } else {
    return HEALTH_GREEN;
  }
}

export default function BorrowTable(props: BorrowTableProps) {
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
            <th className='px-4 py-2 text-end'>
              <Text size='S' weight='bold'>
                APR
              </Text>
            </th>
            <th className='px-4 py-2 text-center'>
              <Text size='S' weight='bold'>
                Health
              </Text>
            </th>
            <th className='px-4 py-2 text-end'>
              <Text size='S' weight='bold'>
                Source
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
                  <Display size='XS'>{row.asset.symbol}</Display>
                </div>
              </td>
              <td className='px-4 py-2 text-end'>
                <Display size='XS'>${row.balanceUsd.toFixed(2)}</Display>
                <Display size='XXS' color='rgba(130, 160, 182, 1)'>
                  {formatTokenAmount(row.balance)} {row.asset.symbol}
                </Display>
              </td>
              <td className='px-4 py-2 text-end'>
                <Display size='XS'>{row.apr.toFixed(2)}%</Display>
              </td>
              <td className='px-4 py-2'>
                <div className='flex justify-center items-center'>
                  <HealthDot color={getHealthColor(row.health)} />
                </div>
              </td>
              <td className='px-4 py-2 text-end'>
                <Display size='XS'>{row.source}</Display>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableContainer>
  );
}
