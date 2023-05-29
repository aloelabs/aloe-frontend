import JSBI from 'jsbi';
import { DropdownOption, DropdownWithPlaceholder } from 'shared/lib/components/common/Dropdown';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { Address } from 'wagmi';

import { ReactComponent as InboxIcon } from '../../../assets/svg/inbox.svg';
import { getRemoveLiquidityActionArgs } from '../../../data/actions/ActionArgs';
import { ActionID } from '../../../data/actions/ActionID';
import { removeLiquidityOperator } from '../../../data/actions/ActionOperators';
import { ActionCardProps, ActionProviders, UniswapPosition } from '../../../data/actions/Actions';
import { sqrtRatioToTick, uniswapPositionKey } from '../../../util/Uniswap';
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

export default function UnsiwapClaimFeesActionCard(props: ActionCardProps) {
  const { marginAccount, accountState, userInputFields, isCausingError, errorMsg, onChange, onRemove } = props;
  const { token0, token1 } = marginAccount;
  const { uniswapPositions, claimedFeeUniswapKeys } = accountState;

  const dropdownOptions = uniswapPositions
    .filter((lp) => !claimedFeeUniswapKeys.includes(uniswapPositionKey(marginAccount.address, lp.lower, lp.upper)))
    .map((lp, index) => {
      return {
        label: `Lower: ${lp.lower} Upper: ${lp.upper}`,
        value: index,
        isDefault: index === 0,
      } as DropdownOption<number>;
    });

  let selectedOption: DropdownOption<number> | undefined = undefined;

  const previousPositionKey = userInputFields?.at(0) ?? '';
  if (previousPositionKey) {
    const selectedIndex = uniswapPositions.findIndex((lp) => {
      return previousPositionKey === uniswapPositionKey(marginAccount.address, lp.lower, lp.upper);
    });
    if (selectedIndex > -1 && selectedIndex < dropdownOptions.length) {
      selectedOption = dropdownOptions[selectedIndex];
    }
  }

  function updateResult(liquidityPosition: UniswapPosition | undefined) {
    const lower = liquidityPosition ? liquidityPosition.lower : null;
    const upper = liquidityPosition ? liquidityPosition.upper : null;
    const updatedLiquidity = JSBI.BigInt(0);

    // Note: Claiming fees is equivalent to removing 0% of liquidity
    onChange(
      {
        actionId: ActionID.REMOVE_LIQUIDITY, // This action is a wrapper around REMOVE_LIQUIDITY hence the actionId used
        actionArgs:
          lower !== null && upper !== null ? getRemoveLiquidityActionArgs(lower, upper, updatedLiquidity) : undefined,
        operator(operand) {
          if (lower == null || upper == null) {
            throw Error('Invalid liquidity position');
          }
          return removeLiquidityOperator(
            operand,
            marginAccount.address as Address,
            updatedLiquidity,
            lower,
            upper,
            sqrtRatioToTick(marginAccount.sqrtPriceX96),
            token0.decimals,
            token1.decimals
          );
        },
      },
      [lower != null && upper != null ? uniswapPositionKey(marginAccount.address, lower, upper) : '']
    );
  }

  function handleSelectOption(updatedOption: DropdownOption<number>) {
    const updatedPosition = uniswapPositions[updatedOption.value];
    updateResult(updatedPosition);
  }

  return (
    <BaseActionCard
      action={ActionID.CLAIM_FEES}
      actionProvider={ActionProviders.UniswapV3}
      isCausingError={isCausingError}
      errorMsg={errorMsg}
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
