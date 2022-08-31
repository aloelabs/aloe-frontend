import { useState } from "react";
import { ActionCardProps, ActionProviders } from "../../../data/Actions";
import { Dropdown, DropdownOption } from "../../common/Dropdown";
import { BaseActionCard } from "../BaseActionCard";

const FAKE_DROPDOWN_OPTIONS: DropdownOption[] = [
  {
    label: 'USDC/WETH $1240',
    value: '1234',
  },
];
export default function UniswapRemoveLiquidityActionCard(props: ActionCardProps) {
  const { token0, token1, previousActionCardState, onChange, onRemove } = props;
  const [selectedOption, setSelectedOption] = useState(FAKE_DROPDOWN_OPTIONS[0]);
  return (
    <BaseActionCard 
      action={ActionProviders.UniswapV3.actions.REMOVE_LIQUIDITY.name}
      actionProvider={ActionProviders.UniswapV3}
      onRemove={onRemove}
    >
      <div>
        <Dropdown
          options={FAKE_DROPDOWN_OPTIONS}
          onSelect={setSelectedOption}
          selectedOption={selectedOption}
        />
      </div>
    </BaseActionCard>
  );
}