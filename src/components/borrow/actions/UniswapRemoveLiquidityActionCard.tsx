import { useState } from "react";
import { ActionCardProps, ActionProviders } from "../../../data/Actions";
import { DropdownOption, DropdownWithPlaceholder } from "../../common/Dropdown";
import { Text } from "../../common/Typography";
import { BaseActionCard } from "../BaseActionCard";

const FAKE_LIQUIDITY_POSITIONS = [
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

export default function UniswapRemoveLiquidityActionCard(props: ActionCardProps) {
  const { token0, token1, previousActionCardState, onChange, onRemove } = props;
  const dropdownOptions = FAKE_LIQUIDITY_POSITIONS.map((lp, index) => {
    return {
      label: `Lower: ${lp.tickLower} Upper: ${lp.tickUpper}`,
      value: index.toString(),
      isDefault: index === 0,
    } as DropdownOption
  });
  let selectedOption: DropdownOption | undefined = undefined;
  const uniswapPosition = previousActionCardState?.uniswapResult?.uniswapPosition;
  if (uniswapPosition) {
    const selectedIndex = FAKE_LIQUIDITY_POSITIONS.findIndex((lp) => {
      return lp.tickLower === uniswapPosition.lowerBound && lp.tickUpper === uniswapPosition.upperBound;
    })
    selectedOption = dropdownOptions[selectedIndex];
  }
  // const [selectedOption, setSelectedOption] = useState<DropdownOption | undefined>(undefined);
  const selectedPosition = selectedOption && FAKE_LIQUIDITY_POSITIONS[parseInt(selectedOption.value)];


  function handleSelectOption(updatedOption: DropdownOption) {
    const updatedPosition = FAKE_LIQUIDITY_POSITIONS[parseInt(updatedOption.value)];
    onChange({
      aloeResult: null,
      uniswapResult: {
        uniswapPosition: {
          amount0: {
            inputValue: updatedPosition.amount0.toString(),
            numericValue: -1 * updatedPosition.amount0,
          },
          amount1: {
            inputValue: updatedPosition.amount1.toString(),
            numericValue: -1 * updatedPosition.amount1,
          },
          lowerBound: updatedPosition.tickLower,
          upperBound: updatedPosition.tickUpper,
        },
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
      </div>
    </BaseActionCard>
  );
}