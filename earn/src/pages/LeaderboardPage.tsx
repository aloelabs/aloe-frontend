import { useMemo, useState } from 'react';

import AppPage from 'shared/lib/components/common/AppPage';
import { LABEL_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import Pagination from 'shared/lib/components/common/Pagination';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_600, GREY_700 } from 'shared/lib/data/constants/Colors';
import { GNFormat } from 'shared/lib/data/GoodNumber';
import { useLeaderboard } from 'shared/lib/hooks/UseLeaderboard';
import styled from 'styled-components';
import { useAccount } from 'wagmi';

const PAGE_SIZE = 10;
const GREEN_ACCENT = 'rgba(82, 182, 154, 1)';

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

const TableHeaderCell = styled.th`
  padding: 0.5rem 1rem;
  text-align: start;
  white-space: nowrap;
`;

const TableBody = styled.tbody`
  text-align: start;
`;

const TableBodyCell = styled.td`
  padding: 0.5rem 1rem;
  text-align: start;
  white-space: nowrap;
`;

const TableRow = styled.tr<{ $selected: boolean }>`
  background-color: ${(props) => (props.$selected ? GREY_700 : 'transparent')};
`;

const UserLabel = styled(Text)`
  display: inline-block;
  background-color: ${GREEN_ACCENT};
  border-radius: 4px;
  padding: 2px 4px;
  margin-right: 8px;
`;

export default function LeaderboardPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const { address } = useAccount();

  const { data: leaderboardEntries } = useLeaderboard();

  const pages = useMemo(() => {
    if (leaderboardEntries == null) {
      return [];
    }
    const pages = [];
    for (let i = 0; i < leaderboardEntries.length; i += PAGE_SIZE) {
      pages.push(leaderboardEntries.slice(i, i + PAGE_SIZE));
    }
    return pages;
  }, [leaderboardEntries]);

  const getRowEmoji = (page: number, index: number) => {
    if (page > 1) return '';
    switch (index) {
      case 0:
        return '🥇';
      case 1:
        return '🥈';
      case 2:
        return '🥉';
      default:
        return '';
    }
  };

  return (
    <AppPage>
      <div className='flex flex-col gap-4 max-w-screen-xl m-auto'>
        <Text size='XXL' className='mb-4'>
          Aloe Leaderboard
        </Text>
        <Text size='M' color={LABEL_TEXT_COLOR} className='mb-4'>
          Points are intended to be a loyalty metric and have no financial value at this time. You{' '}
          <strong>should not</strong> make any investment decisions based on perceived value of points or other
          speculations.
        </Text>
        {pages.length > 0 && (
          <TableContainer>
            <Table>
              <TableHeader>
                <tr>
                  <TableHeaderCell>
                    <Text size='M' weight='bold'>
                      Rank
                    </Text>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <Text size='M' weight='bold'>
                      Address
                    </Text>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <Text size='M' weight='bold'>
                      Points
                    </Text>
                  </TableHeaderCell>
                </tr>
              </TableHeader>
              <TableBody>
                {pages[currentPage - 1]?.map((entry, index) => {
                  const isUser = address?.toLowerCase() === entry.address.toLowerCase();
                  return (
                    <TableRow $selected={isUser} key={entry.address}>
                      <TableBodyCell>
                        <Text size='M'>
                          {(currentPage - 1) * PAGE_SIZE + index + 1}&emsp;{getRowEmoji(currentPage, index)}
                        </Text>
                      </TableBodyCell>
                      <TableBodyCell>
                        {isUser && <UserLabel>You</UserLabel>}
                        <code>{entry?.ens?.name ?? entry.address}</code>
                      </TableBodyCell>
                      <TableBodyCell>
                        <Display size='XS'>{entry.score.toString(GNFormat.LOSSY_HUMAN)}</Display>
                      </TableBodyCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <tfoot>
                <tr>
                  <td className='px-4 py-2' colSpan={5}>
                    <Pagination
                      currentPage={currentPage}
                      itemsPerPage={PAGE_SIZE}
                      totalItems={leaderboardEntries?.length ?? 0}
                      loading={false}
                      onPageChange={(page) => setCurrentPage(page)}
                    />
                  </td>
                </tr>
              </tfoot>
            </Table>
          </TableContainer>
        )}
      </div>
    </AppPage>
  );
}
