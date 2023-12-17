import { useContext, useEffect, useMemo, useState } from 'react';

import axios, { AxiosResponse } from 'axios';
import { BigNumber } from 'ethers';
import AppPage from 'shared/lib/components/common/AppPage';
import Pagination from 'shared/lib/components/common/Pagination';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_600 } from 'shared/lib/data/constants/Colors';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import useSafeState from 'shared/lib/data/hooks/UseSafeState';
import styled from 'styled-components';

import { ChainContext } from '../App';
import { API_LEADERBOARD_URL } from '../data/constants/Values';
import { LeaderboardResponseEntry } from '../data/LeaderboardResponse';

const PAGE_SIZE = 10;

type LeaderboardEntry = {
  address: string;
  score: GN;
};

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

export default function LeaderboardPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [leaderboardEntries, setLeaderboardEntries] = useSafeState<Array<LeaderboardEntry> | null>(null);
  const { activeChain } = useContext(ChainContext);

  useEffect(() => {
    (async () => {
      let leaderboardResponse: AxiosResponse<Array<LeaderboardResponseEntry>>;
      try {
        leaderboardResponse = await axios.get(`${API_LEADERBOARD_URL}?chainId=${activeChain.id}`);
      } catch (e) {
        return;
      }
      if (!leaderboardResponse.data) return;
      const updatedLeaderboardEntries = leaderboardResponse.data.map((entry) => ({
        address: entry.address,
        score: GN.fromBigNumber(BigNumber.from(entry.score), 18),
      }));
      setLeaderboardEntries(updatedLeaderboardEntries);
    })();
  }, [activeChain.id, setLeaderboardEntries]);

  const pages: LeaderboardEntry[][] = useMemo(() => {
    if (leaderboardEntries == null) {
      return [];
    }
    const pages: LeaderboardEntry[][] = [];
    for (let i = 0; i < leaderboardEntries.length; i += PAGE_SIZE) {
      pages.push(leaderboardEntries.slice(i, i + PAGE_SIZE));
    }
    return pages;
  }, [leaderboardEntries]);

  return (
    <AppPage>
      <div className='flex flex-col gap-4 max-w-screen-xl m-auto'>
        <Text size='XXL' className='mb-4'>
          Aloe Leaderboard
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
                      Rewards
                    </Text>
                  </TableHeaderCell>
                </tr>
              </TableHeader>
              <TableBody>
                {pages[currentPage - 1]?.map((entry, index) => (
                  <tr key={entry.address}>
                    <TableBodyCell>
                      <Text size='M'>{(currentPage - 1) * PAGE_SIZE + index + 1}</Text>
                    </TableBodyCell>
                    <TableBodyCell>
                      <Text size='M'>{entry.address}</Text>
                    </TableBodyCell>
                    <TableBodyCell>
                      <Display size='XS'>{entry.score.toString(GNFormat.LOSSY_HUMAN)}</Display>
                    </TableBodyCell>
                  </tr>
                ))}
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
