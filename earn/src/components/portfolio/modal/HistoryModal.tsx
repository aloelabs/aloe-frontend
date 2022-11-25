import { formatDistanceToNow } from 'date-fns';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { useNetwork } from 'wagmi';

import { LendingPair } from '../../../data/LendingPair';
import { ERC20TransactionHistory } from '../../../data/TransactionHistory';
import { fixTimestamp } from '../../../util/Dates';
import PortfolioModal from './PortfolioModal';

const TERTIARY_COLOR = '#4b6980';
const SCROLLBAR_TRACK_COLOR = 'rgba(13, 23, 30, 0.75)';
const SCROLLBAR_THUMB_COLOR = 'rgba(75, 105, 128, 0.75)';
const SCROLLBAR_THUMB_HOVER_COLOR = 'rgba(75, 105, 128, 0.6)';
const SCROLLBAR_THUMB_ACTIVE_COLOR = 'rgba(75, 105, 128, 0.5)';

const Wrapper = styled.div`
  height: 400px;
  overflow-y: auto;
  overflow-x: scroll;

  &::-webkit-scrollbar {
    height: 8px;
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background-color: ${SCROLLBAR_TRACK_COLOR};
  }

  &::-webkit-scrollbar-thumb {
    background-color: ${SCROLLBAR_THUMB_COLOR};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-corner {
    background-color: ${SCROLLBAR_TRACK_COLOR};
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: rgba(75, 105, 128, 0.6);
    background-color: ${SCROLLBAR_THUMB_HOVER_COLOR};
  }

  &::-webkit-scrollbar-thumb:active {
    background-color: rgba(75, 105, 128, 0.5);
    background-color: ${SCROLLBAR_THUMB_ACTIVE_COLOR};
  }
`;

const StyledTable = styled.table`
  width: 100%;

  border-collapse: collapse;
  border-spacing: 0;

  th {
    background-color: ${TERTIARY_COLOR};
    color: white;
  }

  th,
  td {
    padding: 4px 16px;
  }

  thead {
    position: sticky;
    top: 0;
  }
`;

export type HistoryModalProps = {
  isOpen: boolean;
  lendingPairs: LendingPair[];
  transactionHistory: ERC20TransactionHistory[];
  setIsOpen: (open: boolean) => void;
};

export default function HistoryModal(props: HistoryModalProps) {
  const { isOpen, transactionHistory, setIsOpen } = props;
  const network = useNetwork();
  const etherscanSubdomain =
    network.chain?.name.toLowerCase() === 'mainnet' ? '' : `${network.chain?.name.toLowerCase()}.`;

  return (
    <PortfolioModal isOpen={isOpen} title='History' setIsOpen={setIsOpen} maxWidth='1000px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='w-full flex flex-col gap-2'>
          <Wrapper>
            <StyledTable>
              <thead>
                <tr>
                  <th className='text-left'>
                    <Text size='M'>Txn Hash</Text>
                  </th>
                  <th className='text-left'>
                    <Text size='M'>Date</Text>
                  </th>
                  <th className='text-left'>
                    <Text size='M'>From</Text>
                  </th>
                  <th className='text-left'>
                    <Text size='M'>To</Text>
                  </th>
                  <th className='text-left'>
                    <Text size='M'>Amount</Text>
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactionHistory.map((transaction, index) => {
                  const timestamp = new Date(fixTimestamp(transaction.timeStamp));
                  const ago = formatDistanceToNow(timestamp, { addSuffix: true });
                  return (
                    <tr key={index}>
                      <td>
                        <Text className='w-24 whitespace-nowrap text-ellipsis overflow-hidden'>
                          <a
                            href={`https://${etherscanSubdomain}etherscan.io/tx/${transaction.hash}`}
                            target='_blank'
                            rel='noreferrer'
                          >
                            {transaction.hash}
                          </a>
                        </Text>
                      </td>
                      <td className='text-left'>
                        <Text className='whitespace-nowrap overflow-hidden'>{ago}</Text>
                      </td>
                      <td className='text-left'>
                        <Text className='w-24 whitespace-nowrap text-ellipsis overflow-hidden' title={transaction.from}>
                          {transaction.from}
                        </Text>
                      </td>
                      <td className='text-left'>
                        <Text className='w-24 whitespace-nowrap text-ellipsis overflow-hidden' title={transaction.to}>
                          {transaction.to}
                        </Text>
                      </td>
                      <td className='text-left'>
                        <Text className='whitespace-nowrap overflow-hidden'>
                          {Number(transaction.value) / 10 ** Number(transaction.tokenDecimal)} {transaction.tokenSymbol}
                        </Text>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </StyledTable>
          </Wrapper>
        </div>
      </div>
    </PortfolioModal>
  );
}
