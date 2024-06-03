import { ReactNode, useEffect, useMemo, useState } from 'react';

import { formatDistanceToNowStrict } from 'date-fns';
import Tooltip from 'shared/lib/components/common/Tooltip';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { auctionCurve, sqrtRatioToTick } from 'shared/lib/data/BalanceSheet';
import { RESPONSIVE_BREAKPOINT_MD, RESPONSIVE_BREAKPOINT_SM } from 'shared/lib/data/constants/Breakpoints';
import { MANAGER_NAME_MAP } from 'shared/lib/data/constants/ChainSpecific';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import { LendingPair } from 'shared/lib/data/LendingPair';
import useChain from 'shared/lib/hooks/UseChain';
import { getBlockExplorerUrl } from 'shared/lib/util/Chains';
import { formatTokenAmount } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { Address } from 'viem';
import { usePublicClient } from 'wagmi';

import { BorrowerNftBorrower } from '../../data/hooks/useDeprecatedMarginAccountShim';

const BORROW_TITLE_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const MAX_HEALTH = 10;
const HEALTH_GREEN = 'rgba(0, 193, 67, 1)';
const HEALTH_YELLOW = 'rgba(242, 201, 76, 1)';
const HEALTH_RED = 'rgba(235, 87, 87, 1)';

const MetricCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  background-color: ${GREY_700};
  border-radius: 8px;
  padding: 16px;
`;

const MetricCardPlaceholder = styled.div.attrs((props: { height: number; $animate: boolean }) => props)`
  display: inline-block;
  border-radius: 8px;
  padding: 16px;
  height: ${(props) => props.height}px;
  background-color: ${GREY_700};
  animation: ${(props) => (props.$animate ? 'metricCardShimmer 0.75s forwards linear infinite' : '')};
  background-image: ${(props) =>
    props.$animate ? `linear-gradient(to right, ${GREY_700} 0%, #131f28 20%, ${GREY_700} 40%, ${GREY_700} 100%)` : ''};
  background-repeat: no-repeat;
  background-size: 200% 100%;
  overflow: hidden;
  position: relative;

  @keyframes metricCardShimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }
`;

const HorizontalMetricCardContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  background-color: ${GREY_700};
  border-radius: 8px;
  padding: 16px;
`;

const HealthDot = styled.div<{ color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${(props) => props.color};
`;

const MetricsGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const MetricsGridUpper = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-gap: 16px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    grid-template-columns: 1fr;
  }
`;

const MetricsGridLower = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  grid-gap: 16px;
`;

function getHealthColor(health: number) {
  if (health <= 1.02) {
    return HEALTH_RED;
  } else if (health <= 1.25) {
    return HEALTH_YELLOW;
  } else {
    return HEALTH_GREEN;
  }
}

function MetricCard(props: { label: string; value: string; valueClassName?: string }) {
  const { label, value, valueClassName } = props;
  return (
    <MetricCardContainer>
      <Text size='M' color={BORROW_TITLE_TEXT_COLOR}>
        {label}
      </Text>
      <Display size='L' className={valueClassName}>
        {value}
      </Display>
    </MetricCardContainer>
  );
}

function HorizontalMetricCard(props: { label: string; value?: string; children?: ReactNode }) {
  const { label, value, children } = props;
  return (
    <HorizontalMetricCardContainer>
      <Text size='M' color={BORROW_TITLE_TEXT_COLOR}>
        {label}
      </Text>
      {children === undefined ? <Display size='S'>{value}</Display> : children}
    </HorizontalMetricCardContainer>
  );
}

function HealthMetricCard(props: { health: number }) {
  const { health } = props;
  const healthLabel = health > MAX_HEALTH ? `${MAX_HEALTH}+` : health.toFixed(4);
  const healthColor = getHealthColor(health);
  return (
    <HorizontalMetricCardContainer>
      <div className='flex items-center gap-2'>
        <Text size='M' color={BORROW_TITLE_TEXT_COLOR}>
          Health
        </Text>
        <Tooltip
          buttonSize='S'
          content={`Health is a measure of how close your account is to being liquidated.
              It is calculated by dividing your account's assets by its liabilities.
              If your health is at or below 1.0, your account may be liquidated.`}
          position='top-center'
        />
      </div>
      <div className='flex items-center gap-2'>
        <Display size='S' color={healthColor}>
          {healthLabel}
        </Display>
        <HealthDot color={healthColor} />
      </div>
    </HorizontalMetricCardContainer>
  );
}

export type BorrowMetricsProps = {
  borrowerNft?: BorrowerNftBorrower;
  market?: LendingPair;
  userHasNoMarginAccounts: boolean;
};

export function BorrowMetrics(props: BorrowMetricsProps) {
  const { borrowerNft, market, userHasNoMarginAccounts } = props;

  const dailyInterest0 = ((market?.kitty0Info.borrowAPR || 0) / 365) * (borrowerNft?.liabilities.amount0 || 0);
  const dailyInterest1 = ((market?.kitty1Info.borrowAPR || 0) / 365) * (borrowerNft?.liabilities.amount1 || 0);

  const activeChain = useChain();

  const [, setCurrentTime] = useState(Date.now());
  const [mostRecentModifyTime, setMostRecentModifyTime] = useState<Date | null>(null);

  const [token0Collateral, token1Collateral] = useMemo(
    () => borrowerNft?.assets.amountsAt(sqrtRatioToTick(borrowerNft.sqrtPriceX96)) ?? [0, 0],
    [borrowerNft]
  );

  const publicClient = usePublicClient({ chainId: activeChain.id });
  useEffect(() => {
    (async () => {
      setMostRecentModifyTime(null);
      if (!publicClient || !borrowerNft?.mostRecentModify?.blockNumber) return;
      const block = await publicClient.getBlock({ blockNumber: borrowerNft.mostRecentModify.blockNumber });
      setMostRecentModifyTime(new Date(Number(block.timestamp) * 1000));
    })();
  }, [publicClient, borrowerNft?.mostRecentModify?.blockNumber, setMostRecentModifyTime]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 200);
    if (!borrowerNft?.warningTime) clearInterval(interval);
    return () => clearInterval(interval);
  }, [borrowerNft]);

  if (!borrowerNft)
    return (
      <MetricsGrid>
        <MetricsGridUpper>
          <MetricCardPlaceholder height={96} $animate={!userHasNoMarginAccounts} />
          <MetricCardPlaceholder height={96} $animate={!userHasNoMarginAccounts} />
          <MetricCardPlaceholder height={96} $animate={!userHasNoMarginAccounts} />
          <MetricCardPlaceholder height={96} $animate={!userHasNoMarginAccounts} />
        </MetricsGridUpper>
        <MetricsGridLower>
          <MetricCardPlaceholder height={56} $animate={!userHasNoMarginAccounts} />
          <MetricCardPlaceholder height={56} $animate={!userHasNoMarginAccounts} />
          <MetricCardPlaceholder height={56} $animate={!userHasNoMarginAccounts} />
          <MetricCardPlaceholder height={56} $animate={!userHasNoMarginAccounts} />
        </MetricsGridLower>
      </MetricsGrid>
    );

  const etherscanUrl = getBlockExplorerUrl(activeChain);

  const mostRecentManager = borrowerNft.mostRecentModify
    ? (borrowerNft.mostRecentModify.args.manager as Address)
    : '0x';
  const mostRecentManagerName = Object.hasOwn(MANAGER_NAME_MAP, mostRecentManager)
    ? MANAGER_NAME_MAP[mostRecentManager]
    : undefined;
  const mostRecentManagerUrl = `${etherscanUrl}/address/${mostRecentManager}`;

  const mostRecentModifyHash = borrowerNft.mostRecentModify?.transactionHash;
  const mostRecentModifyUrl = `${etherscanUrl}/tx/${mostRecentModifyHash}`;
  const mostRecentModifyTimeStr = mostRecentModifyTime
    ? formatDistanceToNowStrict(mostRecentModifyTime, {
        addSuffix: true,
        roundingMethod: 'round',
      })
    : '';

  let liquidationAuctionStr = 'Not started';
  if (borrowerNft.warningTime > 0) {
    const auctionStartTime = borrowerNft.warningTime + 5 * 60;
    const currentTime = Date.now() / 1000;
    if (currentTime < auctionStartTime) {
      liquidationAuctionStr = `Begins in ${(auctionStartTime - currentTime).toFixed(1)} seconds`;
    } else {
      liquidationAuctionStr = `${(auctionCurve(currentTime - auctionStartTime) * 100 - 100).toFixed(2)}% incentive`;
    }
  }

  return (
    <MetricsGrid>
      <MetricsGridUpper>
        <MetricCard
          label={`${borrowerNft.token0.symbol} Collateral`}
          value={formatTokenAmount(token0Collateral, 3)}
          valueClassName='underline underline-offset-2 decoration-[#00C143f0]'
        />
        <MetricCard
          label={`${borrowerNft.token1.symbol} Collateral`}
          value={formatTokenAmount(token1Collateral, 3)}
          valueClassName='underline underline-offset-2 decoration-[#00C143f0]'
        />
        <MetricCard
          label={`${borrowerNft.token0.symbol} Borrows`}
          value={formatTokenAmount(borrowerNft.liabilities.amount0 || 0, 3)}
          valueClassName='underline underline-offset-2 decoration-[#EC2D5Bf0]'
        />
        <MetricCard
          label={`${borrowerNft.token1.symbol} Borrows`}
          value={formatTokenAmount(borrowerNft.liabilities.amount1 || 0, 3)}
          valueClassName='underline underline-offset-2 decoration-[#EC2D5Bf0]'
        />
      </MetricsGridUpper>
      <MetricsGridLower>
        <HealthMetricCard health={borrowerNft.health} />
        <HorizontalMetricCard
          label='Daily Interest Owed'
          value={`${formatTokenAmount(dailyInterest0, 2)} ${borrowerNft.token0.symbol},  ${formatTokenAmount(
            dailyInterest1,
            2
          )} ${borrowerNft.token1.symbol}`}
        />
        {mostRecentModifyHash && (
          <HorizontalMetricCard label='Last Modified'>
            <Text size='M'>
              <a className='underline text-purple' rel='noreferrer' target='_blank' href={mostRecentModifyUrl}>
                {mostRecentModifyTimeStr}
              </a>{' '}
              using {mostRecentManagerName ? 'the ' : 'an '}
              <a className='underline text-purple' rel='noreferrer' target='_blank' href={mostRecentManagerUrl}>
                {mostRecentManagerName ?? 'unknown manager'}
              </a>
            </Text>
          </HorizontalMetricCard>
        )}
        <HorizontalMetricCard label='Custom Tag'>
          <Text size='M'>{borrowerNft.userDataHex}</Text>
        </HorizontalMetricCard>
        {borrowerNft.warningTime > 0 && (
          <HorizontalMetricCard label='Liquidation Auction'>
            <Text size='M'>{liquidationAuctionStr}</Text>
          </HorizontalMetricCard>
        )}
      </MetricsGridLower>
    </MetricsGrid>
  );
}
