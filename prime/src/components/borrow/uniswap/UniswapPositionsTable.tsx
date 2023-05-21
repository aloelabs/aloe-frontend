import { useMemo, useState } from 'react';

import { Provider } from '@wagmi/core';
import { Text } from 'shared/lib/components/common/Typography';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { MarginAccount } from 'shared/lib/data/MarginAccount';
import { UniswapPosition } from 'shared/lib/data/UniswapPosition';
import { formatPriceRatioGN } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { UniswapPositionEarnedFees } from '../../../pages/BorrowActionsPage';
import {
  getUniswapPoolBasics,
  UniswapV3PoolBasics,
  tickToPrice,
  uniswapPositionKey,
  getValueOfLiquidity,
} from '../../../util/Uniswap';

const LABEL_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const BORDER_COLOR = 'rgba(26, 41, 52, 1)';
const SCROLLBAR_TRACK_COLOR = 'rgba(13, 23, 30, 0.75)';
const SCROLLBAR_THUMB_COLOR = 'rgba(75, 105, 128, 0.75)';
const SCROLLBAR_THUMB_HOVER_COLOR = 'rgba(75, 105, 128, 0.6)';
const SCROLLBAR_THUMB_ACTIVE_COLOR = 'rgba(75, 105, 128, 0.5)';
const IN_RANGE_COLOR = '#00C143';
const OUT_OF_RANGE_COLOR = '#EB5757';

const Placeholder = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-evenly;
  width: 100%;
  height: 130px;
  background: #0d171e;
  background-image: linear-gradient(to right, #0d171e 0%, #131f28 20%, #0d171e 40%, #0d171e 100%);
  background-repeat: no-repeat;
  /* Allows us to have the animation work with percentages */
  background-size: 200% 130px;
  display: inline-block;
  animation: uniswapPositionsTableShimmer 0.75s forwards linear infinite;
  overflow: hidden;
  position: relative;
  @keyframes uniswapPositionsTableShimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }
`;

const Wrapper = styled.div`
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background-color: ${SCROLLBAR_TRACK_COLOR};
  }

  &::-webkit-scrollbar-thumb {
    background-color: ${SCROLLBAR_THUMB_COLOR};
    border-radius: 4px;
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
  overflow: hidden;
  border-collapse: collapse;
  background-color: rgba(13, 24, 33, 1);
`;

const StyledTableRows = styled.tr`
  width: 100%;
  white-space: nowrap;
  border-collapse: collapse;

  th,
  td {
    text-align: start;
    padding: 8px 16px;
  }

  th {
    border-bottom: 1px solid ${BORDER_COLOR};
  }

  &:not(:last-child) {
    td {
      border-bottom: 1px solid ${BORDER_COLOR};
    }
  }
`;

type UniswapPositionInfo = {
  value: GN;
  feesEarned: GN;
  lower: GN;
  upper: GN;
  current: GN;
  positionKey: string;
};

function calculateUniswapPositionInfo(
  accountAddress: string,
  uniswapPosition: UniswapPosition,
  uniswapPoolBasics: UniswapV3PoolBasics,
  token1Decimals: number
): UniswapPositionInfo {
  // TODO: is it even possible for these to be null?
  if (uniswapPosition.lower == null || uniswapPosition.upper == null) {
    return {
      value: GN.zero(token1Decimals),
      feesEarned: GN.zero(token1Decimals),
      lower: GN.zero(96, 2),
      upper: GN.zero(96, 2),
      current: GN.zero(96, 2),
      positionKey: '',
    };
  }
  const currentTick = uniswapPoolBasics.slot0.tick;
  // Since lower doesn't always equate to the smaller value, we need to check which is the smaller value
  const priceBounds = [tickToPrice(uniswapPosition.lower), tickToPrice(uniswapPosition.upper)];
  const lowerPrice = GN.min(...priceBounds);
  const upperPrice = GN.max(...priceBounds);
  const currentPrice = tickToPrice(currentTick);

  // Getting the overall value of the position (includes both amount0 and amount1)
  const valueInTermsOfToken1 = getValueOfLiquidity(
    uniswapPosition.liquidity,
    uniswapPosition.lower,
    uniswapPosition.upper,
    currentTick,
    token1Decimals
  );

  const tickBounds = [uniswapPosition.lower, uniswapPosition.upper];
  const positionKey = uniswapPositionKey(accountAddress, Math.min(...tickBounds), Math.max(...tickBounds));
  return {
    value: valueInTermsOfToken1,
    feesEarned: GN.zero(token1Decimals),
    lower: lowerPrice,
    upper: upperPrice,
    current: currentPrice,
    positionKey,
  };
}

export type UniswapPositionsTableProps = {
  accountAddress: string;
  marginAccount: MarginAccount;
  provider: Provider;
  uniswapPositions: readonly UniswapPosition[];
  uniswapPositionEarnedFees: UniswapPositionEarnedFees;
  isInTermsOfToken0: boolean;
  showAsterisk: boolean;
};

export default function UniswapPositionTable(props: UniswapPositionsTableProps) {
  const {
    accountAddress,
    marginAccount,
    provider,
    uniswapPositions,
    uniswapPositionEarnedFees,
    isInTermsOfToken0,
    showAsterisk,
  } = props;
  const [uniswapPoolBasics, setUniswapPoolBasics] = useState<UniswapV3PoolBasics | null>(null);

  useEffectOnce(() => {
    let mounted = true;
    async function fetch() {
      const poolBasics = await getUniswapPoolBasics(marginAccount.uniswapPool, provider);
      if (mounted) {
        setUniswapPoolBasics(poolBasics);
      }
    }
    fetch();

    return () => {
      mounted = false;
    };
  });

  const uniswapPositionInfo: UniswapPositionInfo[] = useMemo(() => {
    if (!uniswapPoolBasics) {
      return [];
    }
    const positionInfoDict: { [key: string]: UniswapPositionInfo } = {};
    const intermediatePositions = uniswapPositions.map((uniswapPosition: UniswapPosition) => {
      return calculateUniswapPositionInfo(
        accountAddress,
        uniswapPosition,
        uniswapPoolBasics,
        marginAccount.token1.decimals
      );
    });
    // We need to combine the positions with the same position key
    intermediatePositions.forEach((position: UniswapPositionInfo) => {
      if (positionInfoDict[position.positionKey]) {
        positionInfoDict[position.positionKey].value = positionInfoDict[position.positionKey].value.add(position.value);
        positionInfoDict[position.positionKey].feesEarned = positionInfoDict[position.positionKey].feesEarned.add(
          position.feesEarned
        );
      } else {
        positionInfoDict[position.positionKey] = position;
      }
    });
    return Object.values(positionInfoDict);
  }, [uniswapPoolBasics, uniswapPositions, accountAddress, marginAccount]);

  if (!uniswapPoolBasics || !uniswapPositionEarnedFees) {
    return <Placeholder />;
  }

  const columns = ['Value', 'Fees Earned', 'Lower', 'Upper', 'Status'];

  const selectedToken = isInTermsOfToken0 ? marginAccount.token0 : marginAccount.token1;

  // This just saves us from having to specify all the args every time we use it.
  const formatPriceRatio_ = (p: GN) => {
    return formatPriceRatioGN(p, marginAccount.token0.decimals, marginAccount.token1.decimals, isInTermsOfToken0);
  };

  let rows: Array<JSX.Element[]> = [];
  for (const item of uniswapPositionInfo) {
    // TODO: sometimes we have issues with undefined values here, investigate
    const fees = uniswapPositionEarnedFees[item.positionKey];
    if (!fees) {
      continue;
    }
    const selectedTokenSymbol = selectedToken.symbol;
    const value = isInTermsOfToken0
      ? item.value.setResolution(marginAccount.token0.decimals).div(item.current)
      : item.value;

    const valueText = (
      <Text size='M' weight='medium'>
        {value.toString(GNFormat.LOSSY_HUMAN) + ' ' + selectedTokenSymbol}
      </Text>
    );
    const token0FeesEarned = `${fees.token0FeesEarned.toString(GNFormat.LOSSY_HUMAN)} ${marginAccount.token0.symbol}`;
    const token1FeesEarned = `${fees.token1FeesEarned.toString(GNFormat.LOSSY_HUMAN)} ${marginAccount.token1.symbol}`;
    const earnedFeesText = (
      <Text size='M' weight='medium'>
        {token0FeesEarned + ' ' + token1FeesEarned}
      </Text>
    );
    const lowerText = (
      <Text size='M' weight='medium'>
        {formatPriceRatio_(isInTermsOfToken0 ? item.upper : item.lower) + ' ' + selectedTokenSymbol}
      </Text>
    );
    const upperText = (
      <Text size='M' weight='medium'>
        {formatPriceRatio_(isInTermsOfToken0 ? item.lower : item.upper) + ' ' + selectedTokenSymbol}
      </Text>
    );
    const isInRange = item.current.gte(item.lower) && item.current.lt(item.upper);
    const inRangeText = isInRange ? (
      <Text size='M' weight='bold' color={IN_RANGE_COLOR}>
        {'In-Range'}
      </Text>
    ) : (
      <Text size='M' weight='bold' color={OUT_OF_RANGE_COLOR}>
        {'Out-of-Range'}
      </Text>
    );
    rows.push([valueText, earnedFeesText, lowerText, upperText, inRangeText]);
  }

  return (
    <Wrapper>
      <StyledTable>
        <thead>
          <StyledTableRows>
            {columns.map((column, index) => (
              <th key={index}>
                <div className='flex'>
                  <Text color={LABEL_TEXT_COLOR}>{column}</Text>
                  {showAsterisk && (
                    <Text size='S' weight='medium' color='rgba(242, 201, 76, 1)'>
                      *
                    </Text>
                  )}
                </div>
              </th>
            ))}
          </StyledTableRows>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <StyledTableRows key={index}>
              {row.map((rowItem, index) => (
                <td key={index}>{rowItem}</td>
              ))}
            </StyledTableRows>
          ))}
        </tbody>
      </StyledTable>
    </Wrapper>
  );
}
