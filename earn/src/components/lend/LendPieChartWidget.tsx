import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';

import { RESPONSIVE_BREAKPOINT_LG } from '../../data/constants/Breakpoints';
import { Text } from 'shared/lib/components/common/Typography';
import { TokenData } from '../../data/TokenData';
import { getProminentColor, rgba } from '../../util/Colors';
import { formatTokenAmountCompact } from '../../util/Numbers';
import { TokenBalance } from '../../pages/LendPage';

// MARK: Capturing Mouse Data on container div ---------------------------------------

const PIE_CHART_HOVER_GROWTH = 1.05;

const PieChartWrapper = styled.div`
  position: relative;
  width: 240px;
  height: 240px;
`;

const PieChartContainer = styled.div`
  transform: rotate(90deg);
`;

const PieChartLabel = styled.div`
  --width: 165px;
  --height: 165px;
  position: absolute;
  width: var(--width);
  height: var(--height);
  // set top left corner to be centered in parent
  left: 50%;
  top: 50%;
  // offset top left corner by element width so that text is centered
  margin-left: calc(var(--width) / -2);
  margin-top: calc(var(--height) / -2);
  // padding and alignment
  padding: 4px 15px;
  display: flex;
  justify-content: center;
  align-items: center;
  // stuff to make animation work
  pointer-events: none;
  transition: all 0.1s linear;
  // colors, borders, text
  border-radius: calc(var(--height) / 2);
  background-color: rgba(7, 14, 18, 1);
  color: rgba(255, 255, 255, 1);
  ${tw`font-bold`};
`;

// MARK: Pie chart setup -------------------------------------------------------------

type PieChartSlice = {
  index: number;
  percent: number;
  color: string;
};

type LendPieChartSlice = PieChartSlice & {
  tokenBalance: TokenBalance;
  pairName: string;
};

type PieChartSlicePath = {
  data: string;
  color: string;
  percent: number;
};

type TokenColor = {
  color: string;
  token: TokenData;
};

function getCoordinatesForPercent(percent: number) {
  const x = Math.cos(2 * Math.PI * percent);
  const y = Math.sin(2 * Math.PI * percent);
  return [x, y];
}

const TokenAllocationWrapper = styled.div`
  ${tw`w-full h-full flex flex-nowrap justify-end items-end`}
  flex-direction: row;
  @media (max-width: ${RESPONSIVE_BREAKPOINT_LG}) {
    flex-direction: column;
  }
`;

const ExpandingPath = styled.path`
  transition: transform 0.15s ease-in;
  :hover {
    transform: scale(${PIE_CHART_HOVER_GROWTH});
  }
`;

export type LendPieChartWidgetProps = {
  tokenBalances: TokenBalance[];
  totalBalanceUSD: number;
};

export default function LendPieChartWidget(props: LendPieChartWidgetProps) {
  const { tokenBalances, totalBalanceUSD } = props;
  const [activeIndex, setActiveIndex] = useState(-1);
  const [tokenColors, setTokenColors] = useState<TokenColor[]>([]);
  const [slices, setSlices] = useState<LendPieChartSlice[]>([]);

  const onMouseEnter = (index: number, percent: string) => {
    setActiveIndex(index);
  };

  const onMouseLeave = () => {
    setActiveIndex(-1);
  };

  // Sort token balances by their corresponding token
  const sortedTokenBalances = useMemo(() => {
    return tokenBalances.sort((a, b) =>
      (b.token?.referenceAddress || b.token.address).localeCompare(a.token?.referenceAddress || a.token.address)
    );
  }, [tokenBalances]);

  useEffect(() => {
    let mounted = true;
    const calculateProminentColors = async () => {
      const tokenColorPromises = sortedTokenBalances.map(async (tokenBalance: TokenBalance) => {
        return {
          color: await getProminentColor(tokenBalance.token.iconPath || ''),
          token: tokenBalance.token,
          isKitty: tokenBalance.isKitty,
        };
      });
      const tokenColorData = await Promise.all(tokenColorPromises);
      if (mounted) {
        setTokenColors(
          tokenColorData.map((tokenColor) => {
            const alpha = tokenColor.isKitty ? 0.75 : 1;
            return {
              color: rgba(tokenColor.color, alpha),
              token: tokenColor.token,
            };
          })
        );
      }
    };
    calculateProminentColors();
    return () => {
      mounted = false;
    };
  }, [sortedTokenBalances, totalBalanceUSD]);

  useEffect(() => {
    if (sortedTokenBalances.length === 0 || totalBalanceUSD === 0) {
      return;
    }
    const sliceData = sortedTokenBalances.map((tokenBalance, index) => {
      const tokenColor = tokenColors.find((tc) => tc.token.address === tokenBalance.token.address)?.color;
      return {
        index: index,
        percent: tokenBalance.balanceUSD / totalBalanceUSD,
        color: tokenColor || 'transparent',
        tokenBalance: tokenBalance,
        pairName: tokenBalance.pairName,
      };
    });
    setSlices(sliceData);
  }, [sortedTokenBalances, tokenColors, totalBalanceUSD]);

  let cumulativePercent = 0;
  const paths: PieChartSlicePath[] = slices.map((slice) => {
    // destructuring assignment sets the two variables at once
    const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
    // each slice starts where the last slice ended, so keep a cumulative percent
    cumulativePercent += slice.percent;
    const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
    // if the slice is more than 50%, take the large arc (the long way around)
    const largeArcFlag = slice.percent > 0.5 ? 1 : 0;

    // create an array and join it just for code readability
    const pathData = [
      `M ${startX} ${startY}`, // Move
      `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
      `L 0 0`, // Line
    ].join(' ');
    return {
      data: pathData,
      color: slice.color,
      percent: slice.percent,
    };
  });

  const activeSlice = activeIndex !== -1 ? slices.find((slice) => slice.index === activeIndex) : undefined;
  const currentPercent = activeSlice ? `${(activeSlice.percent * 100).toFixed(2)}%` : '';

  return (
    <div className='w-full flex flex-col items-start justify-start self-baseline'>
      <TokenAllocationWrapper>
        <PieChartWrapper>
          <PieChartContainer>
            <svg viewBox='-1 -1 2 2' overflow='visible'>
              {paths.map((path, index) => {
                return (
                  <ExpandingPath
                    key={index}
                    d={path.data}
                    fill={path.color}
                    onMouseEnter={() => onMouseEnter(index, path.percent.toString())}
                    onMouseLeave={() => onMouseLeave()}
                  ></ExpandingPath>
                );
              })}
            </svg>
          </PieChartContainer>

          <PieChartLabel>
            {activeSlice && (
              <div className='flex flex-col justify-center items-center gap-1'>
                <Text size='M' weight='bold' color={activeSlice.color}>
                  {formatTokenAmountCompact(activeSlice.tokenBalance.balance)}{' '}
                  {activeSlice.tokenBalance.token.ticker || ''}
                </Text>
                {activeSlice.tokenBalance.isKitty && (
                  <Text size='XS' color='rgba(255, 255, 255, 0.5)'>
                    {activeSlice.pairName}
                  </Text>
                )}
                <Text size='L'>{currentPercent}</Text>
              </div>
            )}
            {!activeSlice && <Text size='L'>Your Assets</Text>}
          </PieChartLabel>
        </PieChartWrapper>
      </TokenAllocationWrapper>
    </div>
  );
}
