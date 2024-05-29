import { useEffect, useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { ethers } from 'ethers';
import { Tooltip } from 'react-tooltip';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { liquidatorAbi } from 'shared/lib/abis/Liquidator';
import DownArrow from 'shared/lib/assets/svg/DownArrow';
import OpenIcon from 'shared/lib/assets/svg/OpenNoPad';
import UpArrow from 'shared/lib/assets/svg/UpArrow';
import { FilledGreyButton } from 'shared/lib/components/common/Buttons';
import Pagination from 'shared/lib/components/common/Pagination';
import TokenIcons from 'shared/lib/components/common/TokenIcons';
import { Text, Display } from 'shared/lib/components/common/Typography';
import { Borrower } from 'shared/lib/data/Borrower';
import { ALOE_II_BORROWER_NFT_ADDRESS, ALOE_II_LIQUIDATOR_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GREY_600, GREY_700 } from 'shared/lib/data/constants/Colors';
import { Q32 } from 'shared/lib/data/constants/Values';
import { GNFormat } from 'shared/lib/data/GoodNumber';
import { LendingPair } from 'shared/lib/data/LendingPair';
import useChain from 'shared/lib/hooks/UseChain';
import useSortableData from 'shared/lib/hooks/UseSortableData';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';
import { getHealthColor } from 'shared/lib/util/Health';
import { formatTokenAmountCompact } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { useAccount, useWriteContract } from 'wagmi';

import { ReactComponent as InfoIcon } from '../../../assets/svg/info.svg';
import { ZERO_ADDRESS } from '../../../data/constants/Addresses';
import { truncateAddress } from '../../../util/Addresses';

const PAGE_SIZE = 10;
const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const RED_COLOR = 'rgba(234, 87, 87, 0.75)';

const EXPLANATORY_TOOLTIPS = {
  ps: {
    text: "The account's total borrows. The auction incentive will be expressed as a percentage of this value.",
  },
  incentive: {
    // eslint-disable-next-line max-len
    text: 'A small amount of ETH for Warn (for gas costs); a variable amount tokens for Liquidate (for gas and swap costs)',
  },
  health: {
    text: 'Accounts with health less than 1 can be warned and liquidated.',
  },
  auction: {
    // eslint-disable-next-line max-len
    text: 'Auctions begin 5 minutes after warning. The incentive, based on the TWAP, starts at 0%－meaning the liquidator is donating to the protocol. After 5 more minutes, the incentive rises to 100%－meaning the liquidator breaks-even. Further growth implies a reward.',
  },
};

function formatAuctionTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = (seconds % 60).toFixed(0).padStart(2, '0');

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  border: 2px solid ${GREY_600};
  border-radius: 6px;
`;

const TableHeader = styled.thead`
  border-bottom: 2px solid ${GREY_600};
  text-align: start;
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

export type LiquidateTableRowProps = {
  lendingPair: LendingPair;
  positionValue: number;
  health: number;
  borrower: Borrower;
  setPendingTxn: (data: WriteContractReturnType) => void;
};

function LiquidateTableRow(props: LiquidateTableRowProps) {
  const { lendingPair: pair, positionValue, health, borrower, setPendingTxn } = props;
  const activeChain = useChain();
  const { address: userAddress } = useAccount();

  const [, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    if (borrower.warnTime === 0) clearInterval(interval);
    return () => clearInterval(interval);
  }, [borrower.warnTime]);

  const { writeContractAsync } = useWriteContract();

  const encodedLiquidateData = useMemo(() => {
    return ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'address', 'address', 'address', 'address'],
      [
        pair.uniswapPool,
        pair.token0.address,
        pair.token1.address,
        pair.kitty0.address,
        pair.kitty1.address,
        userAddress ?? ZERO_ADDRESS,
      ]
    ) as `0x${string}`;
  }, [pair, userAddress]);

  const etherscanUrl = getEtherscanUrlForChain(activeChain);
  const borrowerLink = `${etherscanUrl}/address/${borrower.address}`;

  const isBorrowerNft = borrower.owner === ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id];

  const isHealthy = health > 1;
  const canBeWarned = !isHealthy && borrower.warnTime === 0;
  const warnIncentive = borrower.warnIncentive(pair.factoryData.ante);

  const auctionTime = borrower.auctionTime;
  const auctionCurveValue = borrower.auctionCurveValue;
  let auctionText = 'Inactive';
  if (auctionTime !== undefined) {
    if (auctionTime < 0) {
      auctionText = `T-${formatAuctionTime(-auctionTime)}`;
    } else {
      auctionText = `T+${formatAuctionTime(auctionTime)}`;
    }
  }
  const auctionTextColor = auctionTime === undefined ? SECONDARY_COLOR : 'white';
  const canBeLiquidated = auctionTime && auctionTime > 0;
  let incentiveText = `${warnIncentive.toString(GNFormat.DECIMAL)} ETH`;
  if (auctionTime !== undefined) {
    const incentive = borrower.nominalLiquidationIncentive(pair.oracleData.sqrtPriceX96, 1.0);
    if (incentive === undefined) {
      incentiveText = 'Pending...';
    } else {
      // TODO: Either fix `formatTokenAmountCompact` or use different formatter for negatives
      const incentive0Str = `${formatTokenAmountCompact(incentive.amount0.toNumber())} ${pair.token0.symbol}`;
      const incentive1Str = `${formatTokenAmountCompact(incentive.amount1.toNumber())} ${pair.token1.symbol}`;
      const incentiveEthStr = `${incentive.amountEth.toString(GNFormat.DECIMAL)} ETH`;
      incentiveText = `${incentive0Str}┃${incentive1Str}┃${incentiveEthStr}`;
    }
  }

  const healthText = health >= 10 ? '10+ ' : health.toFixed(4);
  const healthTextColor = getHealthColor(health);

  const lenderLinks = [pair.kitty0.address, pair.kitty1.address].map((addr) => `${etherscanUrl}/address/${addr}`);

  return (
    <tr className='bg-background hover:bg-row-hover/10'>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <div className='flex items-center gap-2'>
          <TokenIcons tokens={[pair.token0, pair.token1]} links={lenderLinks} />
        </div>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <div className='flex items-center gap-2'>
          <Text size='S'>{truncateAddress(borrower.address, 8)}</Text>
          <OpenIconLink href={borrowerLink} target='_blank' rel='noreferrer'>
            <OpenIcon width={12} height={12} />
          </OpenIconLink>
        </div>
        <Display size='XXS' color={SECONDARY_COLOR}>
          {isBorrowerNft ? 'NFT' : 'Manual'}
        </Display>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <Display size='XS'>
          ${positionValue < 1e-4 ? '0.00' : positionValue < 1e4 ? positionValue.toFixed(2) : positionValue.toFixed(0)}
        </Display>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <Display size='XS'>{incentiveText}</Display>
        <Display size='XXS' color={SECONDARY_COLOR}>
          {auctionTime !== undefined ? '(on liquidate)' : '(on warn)'}
        </Display>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <div className='flex gap-5 justify-between'>
          <div>
            <Display size='XS' color={healthTextColor}>
              {healthText}
            </Display>
            <Display size='XXS' color={isHealthy ? SECONDARY_COLOR : RED_COLOR}>
              {isHealthy ? 'Healthy' : 'Unhealthy'}
            </Display>
          </div>
          {true && (
            <FilledGreyButton
              size='S'
              onClick={() =>
                writeContractAsync({
                  address: borrower.address,
                  abi: borrowerAbi,
                  functionName: 'warn',
                  args: [Q32],
                  chainId: activeChain.id,
                })
                  .then((hash) => setPendingTxn(hash))
                  .catch((e) => console.error(e))
              }
              disabled={!canBeWarned || userAddress === undefined}
              backgroundColor={canBeWarned ? RED_COLOR : SECONDARY_COLOR}
            >
              {userAddress === undefined ? 'Connect Wallet' : 'Warn'}
            </FilledGreyButton>
          )}
        </div>
      </td>
      <td className='px-4 py-2 text-start whitespace-nowrap'>
        <div className='flex gap-5 justify-between'>
          <div className='w-[100px]'>
            <Display size='XS' color={auctionTextColor}>
              {auctionCurveValue ? (auctionCurveValue * 100).toFixed(2) : '0'}%
            </Display>
            <Display size='XXS' color={auctionTextColor}>
              {auctionText}
            </Display>
          </div>
          {true && (
            <FilledGreyButton
              size='S'
              onClick={() =>
                writeContractAsync({
                  address: ALOE_II_LIQUIDATOR_ADDRESS[activeChain.id],
                  abi: liquidatorAbi,
                  functionName: 'liquidate',
                  args: [borrower.address, encodedLiquidateData, 10000n, Q32],
                  chainId: activeChain.id,
                })
                  .then((hash) => setPendingTxn(hash))
                  .catch((e) => console.error(e))
              }
              disabled={!canBeLiquidated || userAddress === undefined}
            >
              {userAddress === undefined ? 'Connect Wallet' : 'Liquidate'}
            </FilledGreyButton>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function LiquidateTable(props: { rows: LiquidateTableRowProps[] }) {
  const { rows } = props;
  const [currentPage, setCurrentPage] = useState(1);

  // workaround to get sort data in the outermost scope
  const sortableRows = useMemo(() => {
    return rows.map((row) => ({
      ...row,
      // it's the ratio between these two that matters for oracle stability, so that's what we sort by
      sortA: row.borrower.auctionTime ?? -5 * 60 * 60,
      // sortB: row.lendingPair.ltv,
    }));
  }, [rows]);
  const { sortedRows, requestSort, sortConfig } = useSortableData(sortableRows, {
    primaryKey: 'health',
    secondaryKey: 'positionValue',
    direction: 'ascending',
  });

  const pages: LiquidateTableRowProps[][] = useMemo(() => {
    const pages: LiquidateTableRowProps[][] = [];
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
      {Object.entries(EXPLANATORY_TOOLTIPS).map(([k, v]) => (
        <StyledTooltip
          key={k}
          anchorSelect={`.${k}-tooltip-anchor`}
          place='right'
          opacity={1.0}
          border={'1px solid #CCDFED'}
          disableStyleInjection={true}
        >
          <Text size='S' weight='regular' color='#CCDFED'>
            {v.text}
          </Text>
        </StyledTooltip>
      ))}
      <TableContainer>
        <table className='w-full'>
          <TableHeader>
            <tr>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <Text size='M' weight='bold'>
                  Market
                </Text>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <Text size='M' weight='bold'>
                  Borrower
                </Text>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <SortButton onClick={() => requestSort('positionValue')}>
                  <Text size='M' weight='bold'>
                    Position Size
                  </Text>
                  <InfoIcon width={14} height={14} className='ps-tooltip-anchor' />
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'positionValue'}
                    isSortedDesc={sortConfig?.direction === 'descending'}
                  />
                </SortButton>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <div className='flex items-center gap-1'>
                  <Text size='M' weight='bold'>
                    Incentive
                  </Text>
                  <InfoIcon width={14} height={14} className='incentive-tooltip-anchor' />
                </div>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <SortButton onClick={() => requestSort('health')}>
                  <Text size='M' weight='bold'>
                    Health
                  </Text>
                  <InfoIcon width={14} height={14} className='health-tooltip-anchor' />
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'health'}
                    isSortedDesc={sortConfig?.direction === 'descending'}
                  />
                </SortButton>
              </th>
              <th className='px-4 py-2 text-start whitespace-nowrap'>
                <SortButton onClick={() => requestSort('sortA')}>
                  <Text size='M' weight='bold'>
                    Auction
                  </Text>
                  <InfoIcon width={14} height={14} className='auction-tooltip-anchor' />
                  <SortArrow
                    isSorted={sortConfig?.primaryKey === 'sortA'}
                    isSortedDesc={sortConfig?.direction === 'descending'}
                  />
                </SortButton>
              </th>
            </tr>
          </TableHeader>
          <tbody>
            {pages[currentPage - 1].map((row) => (
              <LiquidateTableRow {...row} key={row.borrower.address} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className='px-4 py-2' colSpan={6}>
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
        </table>
      </TableContainer>
    </>
  );
}
