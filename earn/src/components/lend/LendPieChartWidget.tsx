import { useEffect, useMemo, useRef, useState } from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { formatTokenAmountCompact } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import tw from 'twin.macro';

import { RESPONSIVE_BREAKPOINT_LG, RESPONSIVE_BREAKPOINT_MD } from '../../data/constants/Breakpoints';
import { TokenBalance } from '../../pages/LendPage';
import { getProminentColor, rgba } from '../../util/Colors';

// MARK: Capturing Mouse Data on container div ---------------------------------------

const PIE_CHART_HOVER_GROWTH = 1.05;

const Container = styled.div`
  ${tw`w-full flex flex-col items-start justify-start self-baseline`}

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    display: none;
  }
`;

const PieChartWrapper = styled.div`
  position: relative;
  width: 240px;
  height: 240px;
`;

const PieChartPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: #0d171e;
  background-image: linear-gradient(to right, #0d171e 0%, #131f28 20%, #0d171e 40%, #0d171e 100%);
  background-repeat: no-repeat;
  background-size: 200% 100%;
  display: inline-block;
  animation: lendPieChartShimmer 0.75s forwards linear infinite;
  overflow: hidden;
  position: relative;

  @keyframes lendPieChartShimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }
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
  token: Token;
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
  const cumulativePercent = useRef(0);

  const onMouseEnter = (index: number, percent: string) => {
    setActiveIndex(index);
  };

  const onMouseLeave = () => {
    setActiveIndex(-1);
  };

  // Sort token balances by their corresponding token
  const sortedTokenBalances = useMemo(() => {
    return tokenBalances.sort((a, b) => {
      const aAddress = a.token.underlying.address;
      const bAddress = b.token.underlying.address;
      return bAddress.localeCompare(aAddress);
    });
  }, [tokenBalances]);

  useEffect(() => {
    let mounted = true;
    const calculateProminentColors = async () => {
      const tokenColorPromises = sortedTokenBalances.map(async (tokenBalance: TokenBalance) => {
        return {
          color: await getProminentColor(tokenBalance.token.logoURI || ''),
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
    if (sortedTokenBalances.length > 0) {
      calculateProminentColors();
    }
    return () => {
      mounted = false;
    };
  }, [sortedTokenBalances, totalBalanceUSD]);

  const slices: LendPieChartSlice[] = useMemo(() => {
    if (sortedTokenBalances.length === 0 || totalBalanceUSD === 0) {
      return [];
    }
    return sortedTokenBalances.map((tokenBalance, index) => {
      const tokenColor = tokenColors.find((tc) => tc.token.address === tokenBalance.token.address)?.color;
      return {
        index: index,
        percent: tokenBalance.balanceUSD / totalBalanceUSD,
        color: tokenColor || 'transparent',
        tokenBalance: tokenBalance,
        pairName: tokenBalance.pairName,
      };
    });
  }, [sortedTokenBalances, tokenColors, totalBalanceUSD]);

  // let cumulativePercent = 0;
  const paths: PieChartSlicePath[] = useMemo(() => {
    return slices.map((slice) => {
      // destructuring assignment sets the two variables at once
      const [startX, startY] = getCoordinatesForPercent(cumulativePercent.current);
      // each slice starts where the last slice ended, so keep a cumulative percent
      cumulativePercent.current += slice.percent;
      const [endX, endY] = getCoordinatesForPercent(cumulativePercent.current);
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
  }, [slices]);

  const activeSlice = activeIndex !== -1 ? slices.find((slice) => slice.index === activeIndex) : undefined;
  const currentPercent = activeSlice ? `${(activeSlice.percent * 100).toFixed(2)}%` : '';
  const isLoading = sortedTokenBalances.length === 0 || tokenColors.length === 0 || totalBalanceUSD === 0;
  return (
    <Container>
      <TokenAllocationWrapper>
        <PieChartWrapper>
          {isLoading ? (
            <>
              <PieChartPlaceholder />
              <PieChartLabel />
            </>
          ) : (
            <>
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
                      {activeSlice.tokenBalance.token.symbol || ''}
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
            </>
          )}
        </PieChartWrapper>
      </TokenAllocationWrapper>
    </Container>
  );
}
