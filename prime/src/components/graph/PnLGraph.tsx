import { useContext, useEffect, useState } from 'react';

import { Popover } from '@headlessui/react';
import { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
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
import { SquareInput } from 'shared/lib/components/common/Input';
import { SvgWrapper } from 'shared/lib/components/common/SvgWrapper';
import Tooltip from 'shared/lib/components/common/Tooltip';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_FRONTEND_MANAGER_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN } from 'shared/lib/data/GoodNumber';
import { useDebouncedEffect } from 'shared/lib/data/hooks/UseDebouncedEffect';
import { formatNumberInput } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import tw from 'twin.macro';

import { ChainContext } from '../../App';
import { ReactComponent as CogIcon } from '../../assets/svg/gear.svg';
import { UniswapPosition } from '../../data/actions/Actions';
import { getAssets } from '../../data/BalanceSheet';
import { TOPIC0_MODIFY_EVENT } from '../../data/constants/Signatures';
import { LiquidationThresholds, MarginAccount } from '../../data/MarginAccount';
import { GENERAL_DEBOUNCE_DELAY_MS } from '../../pages/BorrowActionsPage';
import { makeEtherscanRequest } from '../../util/Etherscan';
import { tickToPrice } from '../../util/Uniswap';
import { PnLGraphPlaceholder } from './PnLGraphPlaceholder';
import PnLGraphTooltip from './tooltips/PnLGraphTooltip';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const INPUT_DEBOUNCE_DELAY_MS = 25;
const NUM_TICKS = 4;

const Wrapper = styled.div`
  position: relative;
  width: 100%;
  height: 300px;
`;

const Container = styled.div`
  ${tw`lg:left-[-64px] lg:w-[calc(100% + 64px)]`}
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

function priceToNumber(price: GN, scaler: number, inTermsOfToken0 = false) {
  const priceNumber = price.toDecimalBig().mul(scaler).toNumber();
  return inTermsOfToken0 ? 1 / priceNumber : priceNumber;
}

function calculatePnL(
  marginAccount: MarginAccount,
  uniswapPositions: UniswapPosition[],
  priceX96: GN,
  inTermsOfToken0: boolean,
  initialValue = 0
): number {
  const sqrtPriceX96 = priceX96.sqrt();
  const assets = getAssets(
    marginAccount.assets,
    uniswapPositions,
    sqrtPriceX96,
    sqrtPriceX96,
    sqrtPriceX96,
    marginAccount.token0.decimals,
    marginAccount.token1.decimals
  );

  const assets0 = assets.fixed0.add(assets.fluid0C).sub(marginAccount.liabilities.amount0);
  const assets1 = assets.fixed1.add(assets.fluid1C).sub(marginAccount.liabilities.amount1);

  const value = inTermsOfToken0
    ? assets0.add(assets1.setResolution(marginAccount.token0.decimals).div(priceX96))
    : assets0.setResolution(marginAccount.token1.decimals).mul(priceX96).add(assets1);

  return value.toNumber() - initialValue;
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
  setSwapFeesInputValue: (value: string) => void;
  disabled: boolean;
};

function PnLGraphSettings(props: PnLGraphSettingsProps) {
  const { borrowInterestInputValue, setBorrowInterestInputValue, swapFeeInputValue, setSwapFeesInputValue, disabled } =
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const output = formatNumberInput(e.target.value);
                if (output !== null) setSwapFeesInputValue(output);
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
  borrowInterestInputValue: string;
  swapFeesInputValue: string;
  setBorrowInterestInputValue: (value: string) => void;
  setSwapFeesInputValue: (value: string) => void;
};

const PLOT_X_SCALE = 1.2;

export default function PnLGraph(props: PnLGraphProps) {
  const {
    marginAccount,
    uniswapPositions,
    inTermsOfToken0,
    liquidationThresholds,
    isShowingHypothetical,
    borrowInterestInputValue,
    swapFeesInputValue,
    setBorrowInterestInputValue,
    setSwapFeesInputValue,
  } = props;
  const { activeChain } = useContext(ChainContext);
  const [data, setData] = useState<Array<PnLEntry>>([]);
  const [localInTermsOfToken0, setLocalInTermsOfToken0] = useState<boolean>(inTermsOfToken0);
  const [priceAtLastUpdate, setPriceAtLastUpdate] = useState<GN | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      let etherscanResult: AxiosResponse<any, any> | null = null;
      try {
        etherscanResult = await makeEtherscanRequest(
          0,
          ALOE_II_FRONTEND_MANAGER_ADDRESS[activeChain.id],
          [TOPIC0_MODIFY_EVENT, `0x000000000000000000000000${marginAccount.address.slice(2)}`],
          true,
          activeChain
        );
      } catch (e) {
        console.error(e);
      }
      if (etherscanResult == null || !Array.isArray(etherscanResult.data.result)) return [];
      if (etherscanResult.data.result.length === 0) return [];
      const events = etherscanResult.data.result;
      const mostRecentEvent = events.reduce((prev: { timeStamp: string }, curr: { timeStamp: string }) => {
        return parseInt(curr.timeStamp, 16) > parseInt(prev.timeStamp, 16) ? curr : prev;
      });
      const mostRecentEventData: number = ethers.utils.defaultAbiCoder.decode(['int24'], mostRecentEvent.data)[0];
      const mostRecentPrice = tickToPrice(mostRecentEventData);
      if (mounted) {
        setPriceAtLastUpdate(mostRecentPrice);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [activeChain, activeChain.id, marginAccount.address]);

  const scaler = 10 ** (marginAccount.token0.decimals - marginAccount.token1.decimals);
  let currentPrice = marginAccount.sqrtPriceX96.square();
  let previousPrice = priceAtLastUpdate ?? currentPrice;

  // If we're showing hypothetical, we want to use the current price as the price at the last update
  if (isShowingHypothetical) previousPrice = currentPrice;

  const priceA = GN.min(currentPrice, previousPrice).recklessDiv(PLOT_X_SCALE);
  const priceB = GN.max(currentPrice, previousPrice).recklessMul(PLOT_X_SCALE);

  const numericBorrowInterest = parseFloat(borrowInterestInputValue) || 0.0;
  const numericSwapFees = parseFloat(swapFeesInputValue) || 0.0;
  // Offset the initial value by the borrowInterest and swapFees
  const initialValue =
    calculatePnL(marginAccount, uniswapPositions, previousPrice, inTermsOfToken0) -
    numericBorrowInterest -
    numericSwapFees;

  function calculateGraphData(): Array<PnLEntry> {
    let P = priceA;
    let updatedData = [];
    while (P.lt(priceB)) {
      updatedData.push({
        x: priceToNumber(P, scaler, inTermsOfToken0),
        y: calculatePnL(marginAccount, uniswapPositions, P, inTermsOfToken0, initialValue),
      });
      P = P.recklessMul(1.005);
    }
    return inTermsOfToken0 ? updatedData.reverse() : updatedData;
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
    [borrowInterestInputValue, swapFeesInputValue]
  );

  const liquidationLower = liquidationThresholds?.lower ?? 0;
  const liquidationUpper = liquidationThresholds?.upper ?? Infinity;

  const tickSpacing = priceB.sub(priceA).recklessDiv(NUM_TICKS);
  let ticks = [priceA.add(tickSpacing.recklessDiv(2))];
  for (let i = 1; i < NUM_TICKS; i += 1) {
    ticks.push(ticks[i - 1].add(tickSpacing));
  }

  const gradientOffset = () => {
    const dataMax = Math.max(...data.map((i) => i.y));
    const dataMin = Math.min(...data.map((i) => i.y));

    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;

    return dataMax / (dataMax - dataMin);
  };

  const off = gradientOffset();
  if (data.length === 0 || inTermsOfToken0 !== localInTermsOfToken0) {
    return (
      <div className='w-full flex flex-col gap-4'>
        <div className='flex justify-between items-center'>
          <Text size='L' weight='medium'>
            P&L
          </Text>
          <PnLGraphSettings
            borrowInterestInputValue={borrowInterestInputValue}
            setBorrowInterestInputValue={setBorrowInterestInputValue}
            swapFeeInputValue={swapFeesInputValue}
            setSwapFeesInputValue={setSwapFeesInputValue}
            disabled={true}
          />
        </div>
        <PnLGraphPlaceholder />
        <Text size='M' weight='medium' color={SECONDARY_COLOR}>
          This graph estimates profit and losses arising solely from the structure of your positions. To include
          time-based effects such as borrow interest (-) and swap fees (+), click on the cog on the top right of the
          graph and enter your desired values.
        </Text>
      </div>
    );
  }

  return (
    <div className='w-full flex flex-col gap-4'>
      <div className='flex justify-between items-center'>
        <Text size='L' weight='medium'>
          P&L
        </Text>
        <PnLGraphSettings
          borrowInterestInputValue={borrowInterestInputValue}
          setBorrowInterestInputValue={setBorrowInterestInputValue}
          swapFeeInputValue={swapFeesInputValue}
          setSwapFeesInputValue={setSwapFeesInputValue}
          disabled={data.length === 0}
        />
      </div>
      <Wrapper>
        <Container>
          <ResponsiveContainer width='100%' height={300}>
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
                ticks={ticks.map((tick) => priceToNumber(tick, scaler, inTermsOfToken0))}
                tickFormatter={(value: number) => {
                  return formatNumberRelativeToSize(value);
                }}
                tick={{ fill: SECONDARY_COLOR, fontSize: '14px' }}
                minTickGap={25}
              />
              <YAxis stroke={SECONDARY_COLOR} fontSize='14px' />
              <ReferenceLine y={0} stroke={SECONDARY_COLOR} />
              <RechartsTooltip
                isAnimationActive={false}
                wrapperStyle={{ outline: 'none' }}
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
              <ReferenceLine x={liquidationLower} stroke='rgb(114, 167, 246)' strokeWidth={2} />
              <ReferenceArea x1={data[0].x} x2={liquidationLower} fill='rgba(114, 167, 246, 0.5)' />
              <ReferenceLine x={liquidationUpper} stroke='rgb(114, 167, 246)' strokeWidth={2} />
              <ReferenceArea x1={liquidationUpper} x2={data[data.length - 1].x} fill='rgba(114, 167, 246, 0.5)' />
              <ReferenceLine
                x={priceToNumber(currentPrice, scaler, inTermsOfToken0)}
                stroke='rgb(255, 255, 255)'
                strokeWidth={2}
              />
              <ReferenceLine
                x={priceToNumber(previousPrice, scaler, inTermsOfToken0)}
                stroke={SECONDARY_COLOR}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Container>
      </Wrapper>
      <Text size='M' weight='medium' color={SECONDARY_COLOR}>
        This graph estimates profit and losses arising solely from the structure of your positions. To include
        time-based effects such as borrow interest (-) and swap fees (+), click on the cog on the top right of the graph
        and enter your desired values.
      </Text>
    </div>
  );
}
