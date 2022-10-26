import { ChangeEvent, useEffect, useState } from 'react';

import JSBI from 'jsbi';
import { DropdownOption, DropdownWithPlaceholder } from 'shared/lib/components/common/Dropdown';
import { SquareInputWithTrailingUnit } from 'shared/lib/components/common/Input';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { Address } from 'wagmi';

import { ReactComponent as InboxIcon } from '../../../assets/svg/inbox.svg';
import { ReactComponent as RightArrowIcon } from '../../../assets/svg/small_right_arrow.svg';
import { getRemoveLiquidityActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { removeLiquidityOperator } from '../../../data/actions/ActionOperators';
import { ActionCardProps, ActionProviders, UniswapPosition } from '../../../data/actions/Actions';
import { formatNumberInput, formatTokenAmount } from '../../../util/Numbers';
import { getAmountsForLiquidity, sqrtRatioToTick, uniswapPositionKey } from '../../../util/Uniswap';
import { BaseActionCard } from '../BaseActionCard';

const SVGIconWrapper = styled.div.attrs((props: { width: number; height: number }) => props)`
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  svg {
    path {
      stroke: white;
    }
  }
`;

//TODO: make sure the numbers displayed are accurate and contain enough digits
//TODO: potentially allow for more digits in the percentage input
export default function UniswapRemoveLiquidityActionCard(props: ActionCardProps) {
  const { marginAccount, accountState, userInputFields, isCausingError, forceOutput, onChange, onRemove } = props;
  const { token0, token1 } = marginAccount;
  const { uniswapPositions } = accountState;

  const dropdownOptions = uniswapPositions.map((lp, index) => {
    return {
      label: `Lower: ${lp.lower} Upper: ${lp.upper}`,
      value: index.toString(),
      isDefault: index === 0,
    } as DropdownOption;
  });

  const [localRemoveLiquidityPercentage, setLocalRemoveLiquidityPercentage] = useState('');

  useEffect(() => {
    const previousRemoveLiquidityPercentage = userInputFields?.at(1);
    if (previousRemoveLiquidityPercentage && previousRemoveLiquidityPercentage !== localRemoveLiquidityPercentage) {
      setLocalRemoveLiquidityPercentage(previousRemoveLiquidityPercentage);
    }
  }, [accountState]);

  let selectedOption: DropdownOption | undefined = undefined;
  let selectedPosition: UniswapPosition | undefined = undefined;
  let amount0: number | undefined = undefined;
  let amount1: number | undefined = undefined;

  const previousPositionKey = userInputFields?.at(0) ?? '';
  if (previousPositionKey) {
    const selectedIndex = uniswapPositions.findIndex((lp) => {
      return previousPositionKey === uniswapPositionKey(marginAccount.address, lp.lower, lp.upper);
    });
    if (selectedIndex > -1 && selectedIndex < dropdownOptions.length) {
      selectedOption = dropdownOptions[selectedIndex];
      selectedPosition = uniswapPositions[selectedIndex];
    }

    if (selectedPosition) {
      [amount0, amount1] = getAmountsForLiquidity(
        selectedPosition.liquidity,
        selectedPosition.lower,
        selectedPosition.upper,
        sqrtRatioToTick(marginAccount.sqrtPriceX96),
        marginAccount.token0.decimals,
        marginAccount.token1.decimals
      );
    }
  }

  function parsePercentage(percentageStr: string): number {
    return Math.min(parseFloat(percentageStr), 100) || 0;
  }

  function formatPercentage(percentage: number): string {
    return percentage !== 0 ? percentage.toFixed(2) : '';
  }

  function updateResult(liquidityPosition: UniswapPosition | undefined, percentage: string) {
    const parsedPercentage = parsePercentage(percentage);

    const lower = liquidityPosition ? liquidityPosition.lower : null;
    const upper = liquidityPosition ? liquidityPosition.upper : null;
    const liquidity = liquidityPosition?.liquidity ?? JSBI.BigInt(0);

    const liquidityToRemove = JSBI.divide(
      JSBI.multiply(liquidity, JSBI.BigInt(((parsedPercentage * 10000) / 100).toFixed(0))),
      JSBI.BigInt(10000)
    );

    let amount0 = 0;
    let amount1 = 0;
    if (liquidityPosition) {
      [amount0, amount1] = getAmountsForLiquidity(
        liquidityToRemove,
        liquidityPosition.lower,
        liquidityPosition.upper,
        sqrtRatioToTick(marginAccount.sqrtPriceX96),
        marginAccount.token0.decimals,
        marginAccount.token1.decimals
      );
    }

    onChange(
      {
        actionId: ActionID.REMOVE_LIQUIDITY,
        actionArgs:
          lower !== null && upper !== null ? getRemoveLiquidityActionArgs(lower, upper, liquidityToRemove) : undefined,
        operator(operand) {
          if (lower == null || upper == null) return null;
          return removeLiquidityOperator(
            operand,
            marginAccount.address as Address,
            liquidityToRemove,
            lower,
            upper,
            sqrtRatioToTick(marginAccount.sqrtPriceX96),
            token0.decimals,
            token1.decimals
          );
        },
      },
      [lower != null && upper != null ? uniswapPositionKey(marginAccount.address, lower, upper) : '', percentage]
    );
  }

  function handleSelectOption(updatedOption: DropdownOption) {
    const updatedPosition = uniswapPositions[parseInt(updatedOption.value)];
    updateResult(updatedPosition, localRemoveLiquidityPercentage);
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
                    const parsedPercentage = parsePercentage(localRemoveLiquidityPercentage);
                    const formattedPercentage = formatPercentage(parsedPercentage);
                    updateResult(selectedPosition, formattedPercentage);
                  }}
                />
              </label>
            </div>
            {selectedPosition && (
              <div className='w-max m-auto mt-2'>
                <div className='flex items-center gap-4'>
                  <div className='flex flex-col'>
                    <Text size='S' color='#82a0b6'>
                      Current Balance
                    </Text>
                    <Text size='M'>
                      {formatTokenAmount(amount0 || 0)} {token0?.ticker}
                    </Text>
                    <Text size='M'>
                      {formatTokenAmount(amount1 || 0)} {token1?.ticker}
                    </Text>
                  </div>
                  <SVGIconWrapper width={24} height={24}>
                    <RightArrowIcon width={24} height={24} />
                  </SVGIconWrapper>
                  <div>
                    <Text size='S' color='#82a0b6'>
                      Updated Balance
                    </Text>
                    <Text size='M'>
                      {formatTokenAmount((1 - parsePercentage(localRemoveLiquidityPercentage) / 100) * (amount0 ?? 0))}{' '}
                      {token0?.ticker}
                    </Text>
                    <Text size='M'>
                      {formatTokenAmount((1 - parsePercentage(localRemoveLiquidityPercentage) / 100) * (amount1 ?? 0))}{' '}
                      {token1?.ticker}
                    </Text>
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
