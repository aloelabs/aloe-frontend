import { Provider } from '@wagmi/core';
import { BigNumber, Contract } from 'ethers';
import { useMemo, useState } from 'react';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { UniswapPosition } from '../../../data/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { MarginAccount } from '../../../data/MarginAccount';
import { formatTokenAmount, toBig } from '../../../util/Numbers';
import {
  getUniswapPoolBasics,
  UniswapV3PoolBasics,
  tickToPrice,
  uniswapPositionKey,
  calculateAmountFromAmount,
  getAmountsForLiquidity,
} from '../../../util/Uniswap';

const LABEL_TEXT_COLOR = 'rgba(130, 160, 182, 1)';
const BORDER_COLOR = 'rgba(26, 41, 52, 1)';
const SCROLLBAR_TRACK_COLOR = 'rgba(13, 23, 30, 0.75)';
const SCROLLBAR_THUMB_COLOR = 'rgba(75, 105, 128, 0.75)';
const SCROLLBAR_THUMB_HOVER_COLOR = 'rgba(75, 105, 128, 0.6)';
const SCROLLBAR_THUMB_ACTIVE_COLOR = 'rgba(75, 105, 128, 0.5)';

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
    parseFloat(tickToPrice(uniswapPosition.lower, token0Decimals, token1Decimals, !isInTermsOfToken0)),
    parseFloat(tickToPrice(uniswapPosition.upper, token0Decimals, token1Decimals, !isInTermsOfToken0)),
  ];
  const lowerPrice = Math.min(...priceBounds);
  const upperPrice = Math.max(...priceBounds);
  const currentPrice = parseFloat(tickToPrice(currentTick, token0Decimals, token1Decimals, !isInTermsOfToken0));
  // Calculating the token amounts of the position from the liquidity
  const [amount0, amount1] = getAmountsForLiquidity(
    uniswapPosition.liquidity,
    uniswapPosition.lower ?? 0,
    uniswapPosition.upper ?? 0,
    currentTick,
    token0Decimals,
    token1Decimals
  );
  const activeAmount = isInTermsOfToken0 ? amount0 : amount1;
  const otherAmount = isInTermsOfToken0 ? amount1 : amount0;
  const otherAmountInTermsOfActive = calculateAmountFromAmount(
    otherAmount,
    uniswapPosition.lower,
    uniswapPosition.upper,
    currentTick,
    token0Decimals,
    token1Decimals,
    !isInTermsOfToken0
  ).amount;
  const value = activeAmount + parseFloat(otherAmountInTermsOfActive);
  const tickBounds = [uniswapPosition.lower, uniswapPosition.upper];
  const positionKey = uniswapPositionKey(accountAddress, Math.min(...tickBounds), Math.max(...tickBounds));
  return {
    value,
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
  marginAccountLensContract: Contract;
  provider: Provider;
  uniswapPositions: UniswapPosition[];
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
    async function fetch() {
      const earnedFees: [string[], BigNumber[]] = await marginAccountLensContract.getUniswapPositions(
        marginAccount.address
      );
      const earnedFeesMap: UniswapPositionEarnedFees = {};
      earnedFees[0].forEach((positionId, index) => {
        earnedFeesMap[positionId] = {
          token0FeesEarned: toBig(earnedFees[1][index])
            .div(10 ** marginAccount.token0.decimals)
            .toNumber(),
          token1FeesEarned: toBig(earnedFees[1][index + 1])
            .div(10 ** marginAccount.token1.decimals)
            .toNumber(),
        };
      });
      if (mounted) {
        setUniswapPositionEarnedFees(earnedFeesMap);
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

  const columns = ['Value', 'Fees Earned', 'Lower', 'Upper', 'Current'];

  const selectedToken = isInTermsOfToken0 ? marginAccount.token0 : marginAccount.token1;

  const rows = uniswapPositionInfo.map((uniswapPositionInfo: UniswapPositionInfo) => {
    const fees = uniswapPositionEarnedFees[uniswapPositionInfo.positionKey];
    const selectedTokenTicker = selectedToken?.ticker ?? '';
    const value = `${formatTokenAmount(uniswapPositionInfo.value)} ${selectedTokenTicker}`;
    const token0FeesEarned = `${formatTokenAmount(fees?.token0FeesEarned || 0)} ${marginAccount.token0?.ticker || ''}`;
    const token1FeesEarned = `${formatTokenAmount(fees?.token1FeesEarned || 0)} ${marginAccount.token1?.ticker || ''}`;
    const lower = `${formatTokenAmount(uniswapPositionInfo.lower)} ${selectedTokenTicker}`;
    const upper = `${formatTokenAmount(uniswapPositionInfo.upper)} ${selectedTokenTicker}`;
    const current = `${formatTokenAmount(uniswapPositionInfo.current)} ${selectedTokenTicker}`;
    return [value, token0FeesEarned + ' + ' + token1FeesEarned, lower, upper, current];
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
                <td key={index}>
                  <Text size='M' weight='medium'>
                    {rowItem}
                  </Text>
                </td>
              ))}
            </StyledTableRows>
          ))}
        </tbody>
      </StyledTable>
    </Wrapper>
  );
}
