import { ActionCardProps, ActionProviders, DEFAULT_ACTION_VALUE } from "../../../data/Actions";
import { DropdownOption, DropdownWithPlaceholder } from "../../common/Dropdown";
import { Text } from "../../common/Typography";
import { BaseActionCard } from "../BaseActionCard";
import { ReactComponent as InboxIcon } from '../../../assets/svg/inbox.svg';
import styled from "styled-components";
import { SquareInputWithTrailingUnit } from "../../common/Input";
import { ChangeEvent, useState } from "react";
import { formatNumberInput } from "../../../util/Numbers";

export type UniswapV3LiquidityPosition = {
  amount0: number;
  amount1: number;
  tickLower: number;
  tickUpper: number;
}

const FAKE_LIQUIDITY_POSITIONS: Array<UniswapV3LiquidityPosition> = [
  {
    amount0: 100,
    amount1: 50,
    tickLower: 190000,
    tickUpper: 210000,
  },
  {
    amount0: 200,
    amount1: 100,
    tickLower: 195000,
    tickUpper: 215000,
  },
];

const SVGIconWrapper = styled.div`
  width: 32px;
  height: 32px;
  svg {
    path {
      stroke: white;
    }
  }
`;

export default function UniswapRemoveLiquidityActionCard(props: ActionCardProps) {
  const { token0, token1, previousActionCardState, onChange, onRemove } = props;
  const dropdownOptions = FAKE_LIQUIDITY_POSITIONS.map((lp, index) => {
    return {
      label: `Lower: ${lp.tickLower} Upper: ${lp.tickUpper}`,
      value: index.toString(),
      isDefault: index === 0,
    } as DropdownOption
  });

  const [localRemoveLiquidityPercentage, setLocalRemoveLiquidityPercentage] = useState('');

  let selectedOption: DropdownOption | undefined = undefined;
  let selectedPosition: UniswapV3LiquidityPosition | undefined = undefined;
  const uniswapPosition = previousActionCardState?.uniswapResult?.uniswapPosition;
  if (uniswapPosition) {
    const selectedIndex = FAKE_LIQUIDITY_POSITIONS.findIndex((lp) => {
      return lp.tickLower === uniswapPosition.lowerBound && lp.tickUpper === uniswapPosition.upperBound;
    })
    if (selectedIndex > -1 && selectedIndex < dropdownOptions.length) {
      selectedOption =  dropdownOptions[selectedIndex];
      selectedPosition = FAKE_LIQUIDITY_POSITIONS[selectedIndex];
    }
  }

  function handleSelectOption(updatedOption: DropdownOption) {
    const updatedPosition = FAKE_LIQUIDITY_POSITIONS[parseInt(updatedOption.value)];
    //TODO: use the percentage
    const updatedAmount0 = updatedPosition.amount0;
    const updatedAmount1 = updatedPosition.amount1;
    onChange({
      //TODO: Update aloe result
      aloeResult: null,
      uniswapResult: {
        uniswapPosition: {
          amount0: {
            inputValue: updatedAmount0.toString(),
            numericValue: -1 * updatedAmount0,
          },
          amount1: {
            inputValue: updatedAmount1.toString(),
            numericValue: -1 * updatedAmount1,
          },
          lowerBound: updatedPosition.tickLower,
          upperBound: updatedPosition.tickUpper,
        },
        slippageTolerance: DEFAULT_ACTION_VALUE,
        isAmount0LastUpdated: undefined,
        isToken0Selected: undefined,
      }
    })
  }

  return (
    <BaseActionCard 
      action={ActionProviders.UniswapV3.actions.REMOVE_LIQUIDITY.name}
      actionProvider={ActionProviders.UniswapV3}
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
            {selectedPosition && (
              <div className='w-max m-auto mt-2'>
                <Text size='M'>amount0: {selectedPosition.amount0} {token0?.ticker}</Text>
                <Text size='M'>amount1: {selectedPosition.amount1} {token1?.ticker}</Text>
                <Text size='M'>tickLower: {selectedPosition.tickLower}</Text>
                <Text size='M'>tickUpper: {selectedPosition.tickUpper}</Text>
              </div>
            )}
            <div className='mt-4'>
              <label className='flex flex-col gap-2'>
                <Text size='M'>Label</Text>
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
                    const parsed = parseFloat(localRemoveLiquidityPercentage);
                    if (!isNaN(parsed)) {
                      //TODO use onChange instead
                      setLocalRemoveLiquidityPercentage(parsed.toFixed(2));
                    }
                  }}
                />
              </label>
            </div>
          </>
        )}
        {dropdownOptions.length === 0 && (
          <div className='flex flex-col gap-2 items-center'>
            <SVGIconWrapper>
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