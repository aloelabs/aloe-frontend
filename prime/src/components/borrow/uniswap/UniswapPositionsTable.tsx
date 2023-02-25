import { useMemo, useState } from 'react';

import { Provider } from '@wagmi/core';
import { BigNumber, Contract } from 'ethers';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { UniswapPosition } from '../../../data/actions/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { MarginAccount } from '../../../data/MarginAccount';
import { formatTokenAmount, toBig } from '../../../util/Numbers';
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

type UniswapPositionEarnedFees = {
  [key: string]: {
    token0FeesEarned: number;
    token1FeesEarned: number;
  };
};

type UniswapPositionInfo = {
  value: number;
  feesEarned: number;
  lower: number;
  upper: number;
  current: number;
  positionKey: string;
};

function calculateUniswapPositionInfo(
  accountAddress: string,
  uniswapPosition: UniswapPosition,
  uniswapPoolBasics: UniswapV3PoolBasics,
  token0Decimals: number,
  token1Decimals: number,
  isInTermsOfToken0: boolean
): UniswapPositionInfo {
  if (uniswapPosition.lower == null || uniswapPosition.upper == null) {
    return {
      value: 0,
      feesEarned: 0,
      lower: 0,
      upper: 0,
      current: 0,
      positionKey: '',
    };
  }
  const currentTick = uniswapPoolBasics.slot0.tick;
  // Since lower doesn't always equate to the smaller value, we need to check which is the smaller value
  const priceBounds = [
    tickToPrice(uniswapPosition.lower, token0Decimals, token1Decimals, !isInTermsOfToken0),
    tickToPrice(uniswapPosition.upper, token0Decimals, token1Decimals, !isInTermsOfToken0),
  ];
  const lowerPrice = Math.min(...priceBounds);
  const upperPrice = Math.max(...priceBounds);
  const currentPrice = tickToPrice(currentTick, token0Decimals, token1Decimals, !isInTermsOfToken0);

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
    value: isInTermsOfToken0 ? valueInTermsOfToken1 * currentPrice : valueInTermsOfToken1,
    feesEarned: 0,
    lower: lowerPrice,
    upper: upperPrice,
    current: currentPrice,
    positionKey,
  };
}

export type UniswapPositionsTableProps = {
  accountAddress: string;
  marginAccount: MarginAccount;
  marginAccountLensContract: Contract | null;
  provider: Provider;
  uniswapPositions: readonly UniswapPosition[];
  isInTermsOfToken0: boolean;
  showAsterisk: boolean;
};

export default function UniswapPositionTable(props: UniswapPositionsTableProps) {
  const {
    accountAddress,
    marginAccount,
    marginAccountLensContract,
    provider,
    uniswapPositions,
    isInTermsOfToken0,
    showAsterisk,
  } = props;
  const [uniswapPoolBasics, setUniswapPoolBasics] = useState<UniswapV3PoolBasics | null>(null);
  const [uniswapPositionEarnedFees, setUniswapPositionEarnedFees] = useState<UniswapPositionEarnedFees>({});

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

  useEffectOnce(() => {
    let mounted = true;
    async function fetch(marginAccountLensContract: Contract) {
      const earnedFees: [string[], BigNumber[]] = await marginAccountLensContract.getUniswapFees(marginAccount.address);
      const earnedFeesMap: UniswapPositionEarnedFees = {};
      earnedFees[0].forEach((positionId, index) => {
        earnedFeesMap[positionId] = {
          token0FeesEarned: toBig(earnedFees[1][index * 2])
            .div(10 ** marginAccount.token0.decimals)
            .toNumber(),
          token1FeesEarned: toBig(earnedFees[1][index * 2 + 1])
            .div(10 ** marginAccount.token1.decimals)
            .toNumber(),
        };
      });
      if (mounted) {
        setUniswapPositionEarnedFees(earnedFeesMap);
      }
    }
    if (marginAccountLensContract) {
      fetch(marginAccountLensContract);
    }

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
        marginAccount.token0.decimals,
        marginAccount.token1.decimals,
        isInTermsOfToken0
      );
    });
    // We need to combine the positions with the same position key
    intermediatePositions.forEach((position: UniswapPositionInfo) => {
      if (positionInfoDict[position.positionKey]) {
        positionInfoDict[position.positionKey].value += position.value;
        positionInfoDict[position.positionKey].feesEarned += position.feesEarned;
      } else {
        positionInfoDict[position.positionKey] = position;
      }
    });
    return Object.values(positionInfoDict);
  }, [uniswapPoolBasics, uniswapPositions, accountAddress, marginAccount, isInTermsOfToken0]);

  if (!uniswapPoolBasics || !uniswapPositionEarnedFees) {
    return <Placeholder />;
  }

  const columns = ['Value', 'Fees Earned', 'Lower', 'Upper', 'Status'];

  const selectedToken = isInTermsOfToken0 ? marginAccount.token0 : marginAccount.token1;

  const rows = uniswapPositionInfo.map((uniswapPositionInfo: UniswapPositionInfo) => {
    const fees = uniswapPositionEarnedFees[uniswapPositionInfo.positionKey];
    const selectedTokenTicker = selectedToken?.ticker ?? '';
    const valueText = (
      <Text size='M' weight='medium'>
        {formatTokenAmount(uniswapPositionInfo.value) + ' ' + selectedTokenTicker}
      </Text>
    );
    const token0FeesEarned = `${formatTokenAmount(fees?.token0FeesEarned || 0)} ${marginAccount.token0?.ticker || ''}`;
    const token1FeesEarned = `${formatTokenAmount(fees?.token1FeesEarned || 0)} ${marginAccount.token1?.ticker || ''}`;
    const earnedFeesText = (
      <Text size='M' weight='medium'>
        {token0FeesEarned + ' ' + token1FeesEarned}
      </Text>
    );
    const lowerText = (
      <Text size='M' weight='medium'>
        {formatTokenAmount(uniswapPositionInfo.lower) + ' ' + selectedTokenTicker}
      </Text>
    );
    const upperText = (
      <Text size='M' weight='medium'>
        {formatTokenAmount(uniswapPositionInfo.upper) + ' ' + selectedTokenTicker}
      </Text>
    );
    const isInRange =
      uniswapPositionInfo.current >= uniswapPositionInfo.lower &&
      uniswapPositionInfo.current < uniswapPositionInfo.upper;
    const inRangeText = isInRange ? (
      <Text size='M' weight='bold' color={IN_RANGE_COLOR}>
        {'In-Range'}
      </Text>
    ) : (
      <Text size='M' weight='bold' color={OUT_OF_RANGE_COLOR}>
        {'Out-of-Range'}
      </Text>
    );
    return [valueText, earnedFeesText, lowerText, upperText, inRangeText];
  });

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
