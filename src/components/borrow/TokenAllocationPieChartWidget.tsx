import React, { useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';

import { RESPONSIVE_BREAKPOINT_LG, RESPONSIVE_BREAKPOINT_MD, RESPONSIVE_BREAKPOINT_SM } from '../../data/constants/Breakpoints';
import { Text } from '../common/Typography';
import { TokenData } from '../../data/TokenData';
import { Assets, MarginAccount } from '../../data/MarginAccount';
import Big from 'big.js';
import { BIGQ96 } from '../../data/constants/Values';

// MARK: Capturing Mouse Data on container div ---------------------------------------

const PIE_CHART_HOVER_GROWTH = 1.05;
const TOKEN0_COLOR_UNISWAP = '#BEEDC7';
const TOKEN0_COLOR_INTEREST_BEARING = '#59D67C';
const TOKEN0_COLOR_RAW = '#00C143';
const TOKEN1_COLOR_UNISWAP = '#BBA3F7';
const TOKEN1_COLOR_INTEREST_BEARING = '#865EF2';
const TOKEN1_COLOR_RAW = '#6002EE';

const PieChartContainer = styled.div`
  transform: rotate(90deg);
`;

// MARK: Pie chart setup -------------------------------------------------------------

type PieChartSlice = {
  index: number;
  percent: number;
  color: string;
};

type AllocationPieChartSlice = PieChartSlice & {
  category: string;
  metric?: string;
};

type PieChartSlicePath = {
  data: string;
  color: string;
  percent: number;
};

function getCoordinatesForPercent(percent: number) {
  const x = Math.cos(2 * Math.PI * percent);
  const y = Math.sin(2 * Math.PI * percent);
  return [x, y];
}

const TokenAllocationWrapper = styled.div`
  ${tw`w-full h-full mt-4 pt-2 flex flex-nowrap`}
  flex-direction: row;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_LG}) {
    flex-direction: column;
  }
`;

const ExpandingPath = styled.path`
  transition: all 0.15s ease-in;

  :hover {
    transform: scale(${PIE_CHART_HOVER_GROWTH});
  }
`;

const PieChartLabel = styled.div`
  --width: 145.28px;
  --height: 145.28px;

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

const TokenAllocationBreakdown = styled.div`
  ${tw`flex flex-col justify-center gap-y-12`};
  margin-left: 45px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_LG}) {
    margin-left: 0;
    margin-top: 32px;
  }
`;

const LabelWrapper = styled.div`
  ${tw`flex flex-col justify-center items-center`};
  & div {
    transition: color 0.15s linear;
  }
`;

const TokenLabel = styled.div`
  width: 80px;
  font-size: 20px;
  font-weight: 400;
  line-height: 30px;
  color: rgba(255, 255, 255, 1);
  transition: color 0.15s linear;

  &.inactive {
    color: rgba(255, 255, 255, 0.5);
  }
`;

const AllocationSection = styled.div<{ color: string }>`
  ${tw`w-full flex`};
  position: relative;
  white-space: nowrap;
  padding-left: 24px;

  /* The colored circles to the left of the label */
  :before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0px;

    width: 8px;
    height: 8px;
    aspect-ratio: 1;
    margin-top: -4px;

    border-radius: 50%;
    background: ${({ color }) => color};
    z-index: 5;
  }

  /* The bar that connects the top circle to a middle circle (doesn't need to extend upwards) */
  :first-child:after {
    content: '';
    position: absolute;
    top: 50%;
    left: 3.5px;
    width: 2px;
    height: 50%;
    background: rgba(255, 255, 255, 0.4);
    z-index: 2;
  }

  /* The bar that connects a middle circle to the surrounding circles */
  :not(:first-child):not(:last-child):after {
    content: '';
    position: absolute;
    top: 0%;
    left: 3.5px;
    width: 2px;
    height: 100%;
    background: rgba(255, 255, 255, 0.4);
    z-index: 2;
  }

  /* The bar that connects the bottom circle to a middle circle (doesn't need to extend downwards) */
  :last-child:after {
    content: '';
    position: absolute;
    top: 0%;
    left: 3.5px;
    width: 2px;
    height: 50%;
    background: rgba(255, 255, 255, 0.4);
    z-index: 2;
  }
`;

const DashedDivider = styled.div`
  margin-left: 8px;
  margin-right: 8px;
  position: relative;
  flex-grow: 1;
  /* The dashed line */
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: calc(50% - 1px);
    width: 100%;
    height: 1px;
    border-bottom: 1px dashed rgba(255, 255, 255, 0.4);
  }
`;

export type TokenAllocationPieChartWidgetProps = {
  token0: TokenData;
  token1: TokenData;
  assets: Assets;
  sqrtPriceX96: Big;
};

export default function TokenAllocationPieChartWidget(props: TokenAllocationPieChartWidgetProps) {
  const { token0, token1, assets, sqrtPriceX96} = props;
  const [activeIndex, setActiveIndex] = useState(-1);
  const [currentPercent, setCurrentPercent] = useState('');

  const onMouseEnter = (index: number, percent: string) => {
    setActiveIndex(index);
    setCurrentPercent(`${(parseFloat(percent) * 100).toFixed(2)}%`);
  };

  const onMouseLeave = () => {
    setActiveIndex(-1);
    setCurrentPercent('');
  };

  const price = BIGQ96.mul(BIGQ96).div(sqrtPriceX96).div(sqrtPriceX96).mul(10 ** (token1.decimals - token0.decimals)).toNumber();
  const totalAssets: number = (
    assets.token0Raw + assets.token1Raw * price +
    assets.token0Plus + assets.token1Plus * price +
    assets.uni0 + assets.uni1 * price
  );

  const slices: AllocationPieChartSlice[] = [
    {
      index: 0,
      percent: assets.token0Raw / totalAssets,
      color: TOKEN0_COLOR_RAW,
      category: 'Raw',
    },
    {
      index: 1,
      percent: assets.token0Plus / totalAssets,
      color: TOKEN0_COLOR_INTEREST_BEARING,
      category: 'Interest Bearing',
    },
    {
      index: 2,
      percent: assets.uni0 / totalAssets,
      color: TOKEN0_COLOR_UNISWAP,
      category: 'Uniswap',
    },
    {
      index: 3,
      percent: assets.uni1 * price / totalAssets,
      color: TOKEN1_COLOR_UNISWAP,
      category: 'Uniswap',
    },
    {
      index: 4,
      percent: assets.token1Plus * price / totalAssets,
      color: TOKEN1_COLOR_INTEREST_BEARING,
      category: 'Interest Bearing',
    },
    {
      index: 5,
      percent: assets.token1Raw * price / totalAssets,
      color: TOKEN1_COLOR_RAW,
      category: 'Raw',
    },
  ];

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

  const firstHalfOfSlices = slices.slice(0, slices.length / 2).reverse();
  const secondHalfOfSlices = slices.slice(slices.length / 2);

  return (
    <div className='w-full flex flex-col items-start justify-start mb-8'>
      <TokenAllocationWrapper>
        <div className='w-[227px] h-[227px] relative'>
          <PieChartContainer>
            <svg viewBox='-1 -1 2 2' overflow='visible'>
              {paths.map((path, index) => {
                return (
                  <ExpandingPath
                    key={index}
                    d={path.data}
                    fill={path.color}
                    onMouseEnter={() =>
                      onMouseEnter(index, path.percent.toString())
                    }
                    onMouseLeave={() => onMouseLeave()}
                  ></ExpandingPath>
                );
              })}
            </svg>
          </PieChartContainer>
          <PieChartLabel>{currentPercent}</PieChartLabel>
        </div>
        <TokenAllocationBreakdown>
          <div className='flex items-center gap-4 w-full'>
            <TokenLabel
              className={
                activeIndex !== -1 && activeIndex >= firstHalfOfSlices.length
                  ? 'inactive'
                  : ''
              }
            >
              {token0?.ticker || ''}
            </TokenLabel>
            <div className='flex flex-col'>
              {firstHalfOfSlices.map((slice, index) => {
                return (
                  <AllocationSection color={slice.color} key={index}>
                    <LabelWrapper>
                      <Text
                        size='L'
                        weight='medium'
                        color={
                          activeIndex !== -1 && activeIndex !== slice.index
                            ? 'rgba(255, 255, 255, 0.5)'
                            : 'rgba(255, 255, 255, 1)'
                        }
                      >
                        {slice.category}
                      </Text>
                    </LabelWrapper>
                    {slice.metric && (
                      <>
                        <DashedDivider />
                        <LabelWrapper>
                          <Text
                            size='M'
                            weight='medium'
                            color={
                              activeIndex !== -1 && activeIndex !== slice.index
                                ? 'rgba(255, 255, 255, 0.5)'
                                : 'rgba(236, 247, 255, 1)'
                            }
                          >
                            {slice.metric}
                          </Text>
                        </LabelWrapper>
                      </>
                    )}
                  </AllocationSection>
                );
              })}
            </div>
          </div>
          <div className='flex items-center gap-4'>
            <TokenLabel
              className={
                activeIndex !== -1 && activeIndex < firstHalfOfSlices.length
                  ? 'inactive'
                  : ''
              }
            >
              {token1?.ticker || ''}
            </TokenLabel>
            <div className='flex flex-col'>
              {secondHalfOfSlices.map((slice, index) => {
                return (
                  <AllocationSection color={slice.color} key={index}>
                    <LabelWrapper>
                      <Text
                        size='L'
                        weight='medium'
                        color={
                          activeIndex !== -1 && activeIndex !== slice.index
                            ? 'rgba(255, 255, 255, 0.5)'
                            : 'rgba(255, 255, 255, 1)'
                        }
                      >
                        {slice.category}
                      </Text>
                    </LabelWrapper>
                    {slice.metric && (
                      <>
                        <DashedDivider />
                        <LabelWrapper>
                          <Text
                            size='M'
                            weight='medium'
                            color={
                              activeIndex !== -1 && activeIndex !== slice.index
                                ? 'rgba(255, 255, 255, 0.5)'
                                : 'rgba(236, 247, 255, 1)'
                            }
                          >
                            {slice.metric}
                          </Text>
                        </LabelWrapper>
                      </>
                    )}
                  </AllocationSection>
                );
              })}
            </div>
          </div>
        </TokenAllocationBreakdown>
      </TokenAllocationWrapper>
    </div>
  );
}
