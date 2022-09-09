import { ActionCardProps, ActionID, ActionProviders } from "../../../data/Actions";
import { DropdownOption, DropdownWithPlaceholder } from "../../common/Dropdown";
import { Text } from "../../common/Typography";
import { BaseActionCard } from "../BaseActionCard";
import { ReactComponent as InboxIcon } from '../../../assets/svg/inbox.svg';
import { ReactComponent as RightArrowIcon } from '../../../assets/svg/small_right_arrow.svg'
import styled from "styled-components";
import { SquareInputWithTrailingUnit } from "../../common/Input";
import { ChangeEvent, useState } from "react";
import { formatNumberInput, formatTokenAmount } from "../../../util/Numbers";
import useEffectOnce from "../../../data/hooks/UseEffectOnce";
import JSBI from 'jsbi';

//TOOD: merge this with the existing UniswapPosition?
export type UniswapV3LiquidityPosition = {
  amount0: number;
  amount1: number;
  tickLower: number;
  tickUpper: number;
  liquidity: JSBI;
}

const FAKE_LIQUIDITY_POSITIONS: Array<UniswapV3LiquidityPosition> = [
  {
    amount0: 0.011,
    amount1: 50,
    tickLower: 190000,
    tickUpper: 210000,
    liquidity: JSBI.BigInt(0),
  },
  {
    amount0: 200,
    amount1: 100,
    tickLower: 195000,
    tickUpper: 215000,
    liquidity: JSBI.BigInt(0),
  },
];

const SVGIconWrapper = styled.div.attrs(
  (props: { 
    width: number,
    height: number,
  }) => props
)`
  width: ${props => props.width}px;
  height: ${props => props.height}px;
  svg {
    path {
      stroke: white;
    }
  }
`;

//TODO: make sure the numbers displayed are accurate and contain enough digits
//TODO: potentially allow for more digits in the percentage input
export default function UniswapRemoveLiquidityActionCard(props: ActionCardProps) {
  const { marginAccount, previousActionCardState, isCausingError, onChange, onRemove } = props;
  const { token0, token1 } = marginAccount;

  const dropdownOptions = FAKE_LIQUIDITY_POSITIONS.map((lp, index) => {
    return {
      label: `Lower: ${lp.tickLower} Upper: ${lp.tickUpper}`,
      value: index.toString(),
      isDefault: index === 0,
    } as DropdownOption
  });

  const [localRemoveLiquidityPercentage, setLocalRemoveLiquidityPercentage] = useState('');

  useEffectOnce(() => {
    const previousRemoveLiquidityPercentage = previousActionCardState?.uniswapResult?.removeLiquidityPercentage;
    if (previousRemoveLiquidityPercentage) {
      setLocalRemoveLiquidityPercentage(previousRemoveLiquidityPercentage.toFixed(3));
    } 
  })

  let selectedOption: DropdownOption | undefined = undefined;
  let selectedPosition: UniswapV3LiquidityPosition | undefined = undefined;
  let amount0: number | undefined = undefined;
  let amount1: number | undefined = undefined;
  const uniswapPosition = previousActionCardState?.uniswapResult?.uniswapPosition;
  if (uniswapPosition) {
    const selectedIndex = FAKE_LIQUIDITY_POSITIONS.findIndex((lp) => {
      return lp.tickLower === uniswapPosition.lowerBound && lp.tickUpper === uniswapPosition.upperBound;
    })
    if (selectedIndex > -1 && selectedIndex < dropdownOptions.length) {
      selectedOption =  dropdownOptions[selectedIndex];
      selectedPosition = FAKE_LIQUIDITY_POSITIONS[selectedIndex];
    }
    
    const previousAmount0 = uniswapPosition.amount0;
    const previousAmount1 = uniswapPosition.amount1;
    if (previousAmount0 !== 0 && previousAmount1 !== 0) {
      amount0 = previousAmount0;
      amount1 = previousAmount1;
    }
  }

  function parsePercentage(percentageStr: string): number {
    return Math.min(parseFloat(percentageStr), 100) || 0;
  }

  function formatPercentage(percentage: number): string {
    return percentage !== 0 ? percentage.toFixed(2) : '';
  }

  function updateResult(liquidityPosition: UniswapV3LiquidityPosition | undefined) {
    const parsedPercentage = parsePercentage(localRemoveLiquidityPercentage);
    const formattedPercentage = formatPercentage(parsedPercentage);
    const updatedAmount0 = liquidityPosition ? liquidityPosition.amount0 * (parsedPercentage / 100.0) : 0;
    const updatedAmount1 = liquidityPosition ? liquidityPosition.amount1 * (parsedPercentage / 100.0) : 0;
    onChange({
      actionId: ActionID.REMOVE_LIQUIDITY,
      aloeResult: {
        token0RawDelta: updatedAmount0,
        token1RawDelta: updatedAmount1,
        selectedToken: null,
      },
      uniswapResult: {
        uniswapPosition: {
          liquidity: liquidityPosition?.liquidity || JSBI.BigInt(0),
          amount0: -updatedAmount0,
          amount1: -updatedAmount1,
          lowerBound: liquidityPosition ? liquidityPosition.tickLower : null,
          upperBound: liquidityPosition ? liquidityPosition.tickUpper : null,
        },
        slippageTolerance: 0,
        removeLiquidityPercentage: parsedPercentage,
        isAmount0LastUpdated: undefined,
        isToken0Selected: undefined,
      }
    });
  }

  function handleSelectOption(updatedOption: DropdownOption) {
    const updatedPosition = FAKE_LIQUIDITY_POSITIONS[parseInt(updatedOption.value)];
    updateResult(updatedPosition);
  }

  return (
    <BaseActionCard 
      action={ActionID.REMOVE_LIQUIDITY}
      actionProvider={ActionProviders.UniswapV3}
      isCausingError={isCausingError}
      onRemove={onRemove}
    >
      <div>
        {dropdownOptions.length > 0 && (
          <>
            <DropdownWithPlaceholder
              options={dropdownOptions}
              onSelect={handleSelectOption}
              selectedOption={selectedOption}
              placeholder='Selected Liquidity Position'
            />
            <div className='mt-4 mb-4'>
              <label className='flex flex-col gap-2'>
                <Text size='S'>Percentage to Remove</Text>
                <SquareInputWithTrailingUnit
                  value={localRemoveLiquidityPercentage}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const output = formatNumberInput(e.currentTarget.value);
                    if (output != null) {
                      setLocalRemoveLiquidityPercentage(output);
                    }
                  }}
                  size='L'
                  unit='%'
                  placeholder='0.00'
                  inputClassName={localRemoveLiquidityPercentage !== '' ? 'active' : ''}
                  onBlur={() => {
                    const parsedPercentage = parsePercentage(localRemoveLiquidityPercentage)
                    const formattedPercentage = formatPercentage(parsedPercentage);
                    updateResult(selectedPosition);
                    setLocalRemoveLiquidityPercentage(formattedPercentage);
                  }}
                />
              </label>
            </div>
            {selectedPosition && (
              <div className='w-max m-auto mt-2'>
                <div className='flex items-center gap-4'>
                  <div className='flex flex-col'>
                    <Text size='S' color='#82a0b6'>Current Balance</Text>
                    <Text size='M'>{formatTokenAmount(selectedPosition.amount0)} {token0?.ticker}</Text>
                    <Text size='M'>{formatTokenAmount(selectedPosition.amount1)} {token1?.ticker}</Text>
                  </div>
                  <SVGIconWrapper width={24} height={24}>
                    <RightArrowIcon width={24} height={24} />
                  </SVGIconWrapper>
                  <div>
                    <Text size='S' color='#82a0b6'>Updated Balance</Text>
                    <Text size='M'>{amount0 ? formatTokenAmount(selectedPosition.amount0 + amount0) : formatTokenAmount(selectedPosition.amount0)} {token0?.ticker}</Text>
                    <Text size='M'>{amount1 ? formatTokenAmount(selectedPosition.amount1 + amount1) : formatTokenAmount(selectedPosition.amount1)} {token1?.ticker}</Text>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {dropdownOptions.length === 0 && (
          <div className='flex flex-col gap-2 items-center'>
            <SVGIconWrapper width={32} height={32}>
              <InboxIcon width={32} height={32} />
            </SVGIconWrapper>
            <Text size='S' className='text-center w-80'>
              Your active Uniswap V3 liquidity positions will appear here.
            </Text>
          </div>
        )}
      </div>
    </BaseActionCard>
  );
}