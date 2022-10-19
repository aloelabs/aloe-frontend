import { ActionCardProps, ActionID, ActionProviders, UniswapPosition } from '../../../data/Actions';
import { DropdownOption, DropdownWithPlaceholder } from '../../common/Dropdown';
import { Text } from 'shared/lib/components/common/Typography';
import { BaseActionCard } from '../BaseActionCard';
import { ReactComponent as InboxIcon } from '../../../assets/svg/inbox.svg';
import styled from 'styled-components';
import JSBI from 'jsbi';
import { getRemoveLiquidityActionArgs } from '../../../connector/MarginAccountActions';

//TOOD: merge this with the existing UniswapPosition?
export type UniswapV3LiquidityPosition = {
  amount0: number;
  amount1: number;
  tickLower: number;
  tickUpper: number;
  liquidity: JSBI;
};

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
  const { uniswapPositions, previousActionCardState, isCausingError, onChange, onRemove } = props;

  const dropdownOptions = uniswapPositions.map((lp, index) => {
    return {
      label: `Lower: ${lp.lower} Upper: ${lp.upper}`,
      value: index.toString(),
      isDefault: index === 0,
    } as DropdownOption;
  });

  let selectedOption: DropdownOption | undefined = undefined;
  const uniswapPosition = previousActionCardState?.uniswapResult?.uniswapPosition;
  if (uniswapPosition) {
    const selectedIndex = uniswapPositions.findIndex((lp) => {
      return lp.lower === uniswapPosition.lower && lp.upper === uniswapPosition.upper;
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
    onChange({
      actionId: ActionID.REMOVE_LIQUIDITY, // This action is a wrapper around REMOVE_LIQUIDITY hence the actionId used
      actionArgs:
        lower !== null && upper !== null ? getRemoveLiquidityActionArgs(lower, upper, updatedLiquidity) : undefined,
      aloeResult: {
        selectedToken: null,
      },
      uniswapResult: {
        uniswapPosition: {
          liquidity: updatedLiquidity,
          lower,
          upper,
        },
        slippageTolerance: 0,
        removeLiquidityPercentage: 0,
        isAmount0LastUpdated: undefined,
        isToken0Selected: undefined,
      },
    });
  }

  function handleSelectOption(updatedOption: DropdownOption) {
    const updatedPosition = uniswapPositions[parseInt(updatedOption.value)];
    updateResult(updatedPosition);
  }

  return (
    <BaseActionCard
      action={ActionID.CLAIM_FEES}
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
