import { useMemo } from 'react';

import Tooltip from 'shared/lib/components/common/Tooltip';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_800 } from 'shared/lib/data/constants/Colors';
import { formatTokenAmount } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import { computeLiquidationThresholds, getAssets, sqrtRatioToPrice } from '../../data/BalanceSheet';
import { RESPONSIVE_BREAKPOINT_MD, RESPONSIVE_BREAKPOINT_SM } from '../../data/constants/Breakpoints';
import { MarginAccount } from '../../data/MarginAccount';
import { UniswapPosition } from '../../data/Uniswap';

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
  background-color: ${GREY_800};
  border-radius: 8px;
  padding: 16px;
`;

const MetricCardPlaceholder = styled.div.attrs((props: { height: number; $animate: boolean }) => props)`
  display: inline-block;
  border-radius: 8px;
  padding: 16px;
  height: ${(props) => props.height}px;
  background-color: #0d171e;
  animation: ${(props) => (props.$animate ? 'metricCardShimmer 0.75s forwards linear infinite' : '')};
  background-image: ${(props) =>
    props.$animate ? 'linear-gradient(to right, #0d171e 0%, #131f28 20%, #0d171e 40%, #0d171e 100%)' : ''};
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
  background-color: ${GREY_800};
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

function MetricCard(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <MetricCardContainer>
      <Text size='M' color={BORROW_TITLE_TEXT_COLOR}>
        {label}
      </Text>
      <Display size='L'>{value}</Display>
    </MetricCardContainer>
  );
}

function HorizontalMetricCard(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <HorizontalMetricCardContainer>
      <Text size='M' color={BORROW_TITLE_TEXT_COLOR}>
        {label}
      </Text>
      <Display size='S'>{value}</Display>
    </HorizontalMetricCardContainer>
  );
}

function HealthMetricCard(props: { health: number }) {
  const { health } = props;
  const healthLabel = health > MAX_HEALTH ? `${MAX_HEALTH}+` : health.toFixed(2);
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
  marginAccount?: MarginAccount;
  dailyInterest0: number;
  dailyInterest1: number;
  uniswapPositions: readonly UniswapPosition[];
  userHasNoMarginAccounts: boolean;
};

export function BorrowMetrics(props: BorrowMetricsProps) {
  const { marginAccount, dailyInterest0, dailyInterest1, uniswapPositions, userHasNoMarginAccounts } = props;

  const maxSafeCollateralFall = useMemo(() => {
    if (!marginAccount) return null;

    const { lowerSqrtRatio, upperSqrtRatio, minSqrtRatio, maxSqrtRatio } = computeLiquidationThresholds(
      marginAccount.assets,
      marginAccount.liabilities,
      uniswapPositions,
      marginAccount.sqrtPriceX96,
      marginAccount.iv,
      marginAccount.nSigma,
      marginAccount.token0.decimals,
      marginAccount.token1.decimals
    );

    if (lowerSqrtRatio.eq(minSqrtRatio) && upperSqrtRatio.eq(maxSqrtRatio)) return Number.POSITIVE_INFINITY;

    const [current, lower, upper] = [marginAccount.sqrtPriceX96, lowerSqrtRatio, upperSqrtRatio].map((sp) =>
      sqrtRatioToPrice(sp, marginAccount.token0.decimals, marginAccount.token1.decimals)
    );

    const assets = getAssets(
      marginAccount.assets.token0Raw,
      marginAccount.assets.token1Raw,
      uniswapPositions,
      lowerSqrtRatio,
      upperSqrtRatio,
      marginAccount.token0.decimals,
      marginAccount.token1.decimals
    );

    // Compute the value of all assets (collateral) at 3 different prices (current, lower, and upper)
    // Denominated in units of token1
    let assetValueCurrent =
      (marginAccount.assets.token0Raw + marginAccount.assets.uni0) * current +
      marginAccount.assets.token1Raw +
      marginAccount.assets.uni1;
    let assetValueAtLower = assets.amount0AtA * lower + assets.amount1AtA;
    let assetValueAtUpper = assets.amount0AtB * upper + assets.amount1AtB;

    // If there are no assets, further results would be spurious, so return null
    if (assetValueCurrent < Number.EPSILON) return null;

    // Compute how much the collateral can drop in value while remaining solvent
    const percentChange1A = Math.abs(assetValueCurrent - assetValueAtLower) / assetValueCurrent;
    const percentChange1B = Math.abs(assetValueCurrent - assetValueAtUpper) / assetValueCurrent;
    const percentChange1 = Math.min(percentChange1A, percentChange1B);

    // Now change to units of token0
    assetValueCurrent /= current;
    assetValueAtLower /= lower;
    assetValueAtUpper /= upper;

    // Again compute how much the collateral can drop in value while remaining solvent,
    // but this time percentages are based on units of token0
    const percentChange0A = Math.abs(assetValueCurrent - assetValueAtLower) / assetValueCurrent;
    const percentChange0B = Math.abs(assetValueCurrent - assetValueAtUpper) / assetValueCurrent;
    const percentChange0 = Math.min(percentChange0A, percentChange0B);

    // Since we don't know whether the user is thinking in terms of "X per Y" or "Y per X",
    // we return the minimum. Error on the side of being too conservative.
    return Math.min(percentChange0, percentChange1);
  }, [marginAccount, uniswapPositions]);

  if (!marginAccount)
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
        </MetricsGridLower>
      </MetricsGrid>
    );

  let liquidationDistanceText = '-';
  if (maxSafeCollateralFall !== null) {
    if (maxSafeCollateralFall === Number.POSITIVE_INFINITY) liquidationDistanceText = '∞';
    else liquidationDistanceText = `${(maxSafeCollateralFall * 100).toPrecision(2)}% drop in collateral value`;
  }

  const token0Collateral = marginAccount.assets.token0Raw + marginAccount.assets.uni0;
  const token1Collateral = marginAccount.assets.token1Raw + marginAccount.assets.uni1;

  return (
    <MetricsGrid>
      <MetricsGridUpper>
        <MetricCard
          label={`${marginAccount.token0.symbol} Collateral`}
          value={formatTokenAmount(token0Collateral, 3)}
        />
        <MetricCard
          label={`${marginAccount.token1.symbol} Collateral`}
          value={formatTokenAmount(token1Collateral, 3)}
        />
        <MetricCard
          label={`${marginAccount.token0.symbol} Borrows`}
          value={formatTokenAmount(marginAccount.liabilities.amount0 || 0, 3)}
        />
        <MetricCard
          label={`${marginAccount.token1.symbol} Borrows`}
          value={formatTokenAmount(marginAccount.liabilities.amount1 || 0, 3)}
        />
      </MetricsGridUpper>
      <MetricsGridLower>
        <HealthMetricCard health={marginAccount.health || 0} />
        <HorizontalMetricCard label='Liquidation Distance' value={liquidationDistanceText} />
        <HorizontalMetricCard
          label='Daily Interest (-)'
          value={`${formatTokenAmount(dailyInterest0, 2)} ${marginAccount.token0.symbol} + ${formatTokenAmount(
            dailyInterest1,
            2
          )} ${marginAccount.token1.symbol}`}
        />
      </MetricsGridLower>
    </MetricsGrid>
  );
}
