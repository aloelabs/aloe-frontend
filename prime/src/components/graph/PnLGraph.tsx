import { Popover } from '@headlessui/react';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styled from 'styled-components';
import { ReactComponent as CogIcon } from '../../assets/svg/gear.svg';
import { UniswapPosition } from '../../data/Actions';
import { useDebouncedEffect } from '../../data/hooks/UseDebouncedEffect';
import {
  getAssets,
  LiquidationThresholds,
  MarginAccount,
  priceToSqrtRatio,
  sqrtRatioToPrice,
} from '../../data/MarginAccount';
import { GENERAL_DEBOUNCE_DELAY_MS } from '../../pages/BorrowActionsPage';
import { formatNumberInput } from '../../util/Numbers';
import { SquareInput } from 'shared/lib/components/common/Input';
import { SvgWrapper } from 'shared/lib/components/common/SvgWrapper';
import Tooltip from '../common/Tooltip';
import { Text } from 'shared/lib/components/common/Typography';
import { PnLGraphPlaceholder } from './PnLGraphPlaceholder';
import PnLGraphTooltip from './tooltips/PnLGraphTooltip';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const INPUT_DEBOUNCE_DELAY_MS = 25;

const Wrapper = styled.div`
  position: relative;
  width: 100%;
  height: 300px;
`;

const Container = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
`;

const StyledSettingsContainer = styled.div`
  width: 300px;
  display: flex;
  flex-direction: column;
  justify-content: start;
  gap: 16px;
  background-color: rgba(13, 20, 26, 1);
  border: 1px solid rgba(26, 32, 44, 1);
  border-radius: 8px;
  padding: 12px;
`;

/**
 *
 * @param value The value to format
 * @returns a string with a number of decimals that is appropriate for the value
 */
export function formatNumberRelativeToSize(value: number): string {
  return Math.abs(value) < 10 ? value.toFixed(6) : value.toFixed(2);
}

function calculatePnL1(
  marginAccount: MarginAccount,
  uniswapPositions: UniswapPosition[],
  price: number,
  initialValue = 0
): number {
  const sqrtPriceX96 = priceToSqrtRatio(price, marginAccount.token0.decimals, marginAccount.token1.decimals);
  const assets = getAssets(marginAccount, uniswapPositions, sqrtPriceX96, sqrtPriceX96, sqrtPriceX96);
  return (
    (assets.fixed0 + assets.fluid0C) * price +
    assets.fixed1 +
    assets.fluid1C -
    (marginAccount.liabilities.amount0 * price + marginAccount.liabilities.amount1 + initialValue)
  );
}

function calculatePnL0(
  marginAccount: MarginAccount,
  uniswapPositions: UniswapPosition[],
  price: number,
  initialValue = 0
): number {
  const invertedPrice = 1 / price;
  const sqrtPriceX96 = priceToSqrtRatio(invertedPrice, marginAccount.token0.decimals, marginAccount.token1.decimals);
  const assets = getAssets(marginAccount, uniswapPositions, sqrtPriceX96, sqrtPriceX96, sqrtPriceX96);
  return (
    (assets.fixed1 + assets.fluid1C) * price +
    assets.fixed0 +
    assets.fluid0C -
    (marginAccount.liabilities.amount1 * price + marginAccount.liabilities.amount0 + initialValue)
  );
}

/**
 * X is price
 * Y is PnL
 */
export type PnLEntry = {
  x: number;
  y: number;
};

type PnLGraphSettingsProps = {
  borrowInterestInputValue: string;
  setBorrowInterestInputValue: (value: string) => void;
  swapFeeInputValue: string;
  setSwapFeeInputValue: (value: string) => void;
  disabled: boolean;
};

function PnLGraphSettings(props: PnLGraphSettingsProps) {
  const { borrowInterestInputValue, setBorrowInterestInputValue, swapFeeInputValue, setSwapFeeInputValue, disabled } =
    props;
  return (
    <Popover className='relative'>
      <Popover.Button>
        <SvgWrapper
          width={32}
          height={32}
          padding={4}
          strokeColor='rgb(255, 255, 255)'
          hoverStrokeColor='rgba(255, 255, 255, 0.7)'
          className='ml-auto'
        >
          <CogIcon />
        </SvgWrapper>
      </Popover.Button>
      <Popover.Panel className='absolute z-10 right-0'>
        <StyledSettingsContainer>
          <div className='flex flex-col'>
            <div className='flex items-center gap-2 mb-1'>
              <label htmlFor='borrow-interest'>
                <Text size='M' weight='medium'>
                  Borrow Interest
                </Text>
              </label>
              <Tooltip
                buttonSize='M'
                position='top-center'
                content={
                  <Text size='S' weight='medium'>
                    If you take out any loans, your liabilities will increase over time due to interest accrual. This
                    has a negative impact on your P&L (thus the negative sign).
                  </Text>
                }
                filled={true}
              />
            </div>
            <SquareInput
              value={borrowInterestInputValue}
              onChange={(e) => {
                // formatting negative input
                const output = formatNumberInput(e.target.value, true);
                if (output !== null) setBorrowInterestInputValue(output);
              }}
              size='S'
              disabled={disabled}
              inputClassName={borrowInterestInputValue !== '' ? 'active' : ''}
              placeholder='-0.00'
              fullWidth={true}
              id='borrow-interest'
            />
          </div>
          <div className='flex flex-col'>
            <div className='flex items-center gap-2 mb-1'>
              <label htmlFor='swap-fees'>
                <Text size='M' weight='medium'>
                  Swap Fees
                </Text>
              </label>
              <Tooltip
                buttonSize='M'
                position='top-center'
                content={
                  <Text size='S' weight='medium'>
                    If you hold any in-range Uniswap Positions, they'll earn swap fees over time. This has a positive
                    impact on your P&L.
                  </Text>
                }
                filled={true}
              />
            </div>
            <SquareInput
              value={swapFeeInputValue}
              onChange={(e) => {
                const output = formatNumberInput(e.target.value);
                if (output !== null) setSwapFeeInputValue(output);
              }}
              size='S'
              disabled={disabled}
              inputClassName={swapFeeInputValue !== '' ? 'active' : ''}
              placeholder='0.00'
              fullWidth={true}
              id='swap-fees'
            />
          </div>
        </StyledSettingsContainer>
      </Popover.Panel>
    </Popover>
  );
}

export type PnLGraphProps = {
  marginAccount: MarginAccount;
  uniswapPositions: UniswapPosition[];
  inTermsOfToken0: boolean;
  liquidationThresholds: LiquidationThresholds | null;
  isShowingHypothetical: boolean;
};

const PLOT_X_SCALE = 1.2;

export default function PnLGraph(props: PnLGraphProps) {
  const { marginAccount, uniswapPositions, inTermsOfToken0, liquidationThresholds, isShowingHypothetical } = props;
  const [data, setData] = useState<Array<PnLEntry>>([]);
  const [localInTermsOfToken0, setLocalInTermsOfToken0] = useState<boolean>(inTermsOfToken0);
  const [borrowInterestInputValue, setBorrowInterestInputValue] = useState<string>('');
  const [swapFeeInputValue, setSwapFeeInputValue] = useState<string>('');

  let price = sqrtRatioToPrice(
    marginAccount.sqrtPriceX96,
    marginAccount.token0.decimals,
    marginAccount.token1.decimals
  );
  if (inTermsOfToken0) price = 1 / price;
  const priceA = price / PLOT_X_SCALE;
  const priceB = price * PLOT_X_SCALE;

  const calculatePnL = inTermsOfToken0 ? calculatePnL0 : calculatePnL1;
  const initialValue = calculatePnL(marginAccount, uniswapPositions, price);

  function calculateGraphData(): Array<PnLEntry> {
    let P = priceA;
    let updatedData = [];
    const borrowInterestNumericValue = parseFloat(borrowInterestInputValue) || 0;
    const swapFeeNumericValue = parseFloat(swapFeeInputValue) || 0;
    while (P < priceB) {
      updatedData.push({
        x: P,
        y:
          calculatePnL(marginAccount, uniswapPositions, P, initialValue) +
          borrowInterestNumericValue +
          swapFeeNumericValue,
      });
      P *= 1.001;
    }
    return updatedData;
  }

  useDebouncedEffect(
    () => {
      const updatedData = calculateGraphData();
      setData(updatedData);
      setLocalInTermsOfToken0(inTermsOfToken0);
    },
    GENERAL_DEBOUNCE_DELAY_MS,
    [inTermsOfToken0, marginAccount, uniswapPositions]
  );

  useDebouncedEffect(
    () => {
      const updatedData = calculateGraphData();
      setData(updatedData);
    },
    INPUT_DEBOUNCE_DELAY_MS,
    [borrowInterestInputValue, swapFeeInputValue]
  );

  const liquidationLower = liquidationThresholds?.lower ?? 0;
  const liquidationUpper = liquidationThresholds?.upper ?? Infinity;

  const closestLowerTickToShow = data[Math.floor((data.length - 1) / 2 - (data.length - 1) / 10)]?.x;
  const closestUpperTickToShow = data[Math.ceil((data.length - 1) / 2 + (data.length - 1) / 10)]?.x;

  const ticks = [price];
  if (liquidationLower > priceA && liquidationLower < closestLowerTickToShow) ticks.push(liquidationLower);
  if (liquidationUpper < priceB && liquidationUpper > closestUpperTickToShow) ticks.push(liquidationUpper);

  const gradientOffset = () => {
    const dataMax = Math.max(...data.map((i) => i.y));
    const dataMin = Math.min(...data.map((i) => i.y));

    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;

    return dataMax / (dataMax - dataMin);
  };

  const off = gradientOffset();
  if (data.length === 0 || inTermsOfToken0 !== localInTermsOfToken0) {
    return <PnLGraphPlaceholder />;
  }

  return (
    <div className='w-full'>
      <Text size='S' weight='medium' color={SECONDARY_COLOR}>
        This graph estimates profit and losses arising solely from the structure of your positions. To include
        time-based effects such as borrow interest (-) and swap fees (+), click on the cog on the top right of the graph
        and enter your desired values.
      </Text>
      <div className='flex flex-col items-end'>
        <PnLGraphSettings
          borrowInterestInputValue={borrowInterestInputValue}
          setBorrowInterestInputValue={setBorrowInterestInputValue}
          swapFeeInputValue={swapFeeInputValue}
          setSwapFeeInputValue={setSwapFeeInputValue}
          disabled={data.length === 0}
        />
      </div>
      <Wrapper>
        <Container>
          <ResponsiveContainer width='99%' height={300}>
            <AreaChart
              data={data}
              margin={{
                top: 10,
                right: 0,
                left: 0,
                bottom: 0,
              }}
            >
              <XAxis
                domain={['dataMin', 'dataMax']}
                dataKey='x'
                type='number'
                axisLine={false}
                axisType='xAxis'
                tickLine={false}
                tickCount={5}
                interval={0}
                ticks={ticks}
                tickFormatter={(value: number) => {
                  return formatNumberRelativeToSize(value);
                }}
                tick={{ fill: SECONDARY_COLOR, fontSize: '14px' }}
                minTickGap={25}
              />
              <YAxis stroke={SECONDARY_COLOR} fontSize='14px' />
              <ReferenceLine y={0} stroke={SECONDARY_COLOR} />
              <ReferenceLine x={price} stroke={SECONDARY_COLOR} strokeWidth={2} />
              <ReferenceLine x={liquidationLower} stroke='rgb(114, 167, 246)' strokeWidth={2} />
              <ReferenceArea x1={data[0].x} x2={liquidationLower} fill='rgba(114, 167, 246, 0.5)' />
              <ReferenceLine x={liquidationUpper} stroke='rgb(114, 167, 246)' strokeWidth={2} />
              <ReferenceArea x1={liquidationUpper} x2={data[data.length - 1].x} fill='rgba(114, 167, 246, 0.5)' />
              <RechartsTooltip
                isAnimationActive={false}
                content={(props: any, active = false) => (
                  <PnLGraphTooltip
                    token0={marginAccount.token0}
                    token1={marginAccount.token1}
                    inTermsOfToken0={inTermsOfToken0}
                    data={props}
                    active={active}
                    showAsterisk={isShowingHypothetical}
                  />
                )}
              />
              <defs>
                <linearGradient id='splitColor' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset={off} stopColor='rgba(128, 196, 128, 0.5)' stopOpacity={1} />
                  <stop offset={off} stopColor='rgba(206, 87, 87, 0.5)' stopOpacity={1} />
                </linearGradient>
                <linearGradient id='splitColorFill' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset={off} stopColor='rgba(128, 196, 128, 1)' stopOpacity={1} />
                  <stop offset={off} stopColor='rgba(206, 87, 87, 1)' stopOpacity={1} />
                </linearGradient>
              </defs>
              <Area
                type='linear'
                dataKey='y'
                stroke='url(#splitColorFill)'
                fill='url(#splitColor)'
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Container>
      </Wrapper>
    </div>
  );
}
