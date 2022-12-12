import { useEffect, useState } from 'react';
import { Dropdown, DropdownOption } from '../common/Dropdown';
import { Chain, useSwitchNetwork } from 'wagmi';
import { CHAIN_LOGOS, SUPPORTED_CHAINS } from '../../data/constants/Chains';

const DROPDOWN_OPTIONS: DropdownOption<Chain>[] = SUPPORTED_CHAINS.map((chain) => ({
  label: chain.name,
  value: chain,
  icon: CHAIN_LOGOS[chain.id],
}));

export type ChainSelectorProps = {
  chain?: Chain;
};

export default function ChainSelector(props: ChainSelectorProps) {
  const { chain } = props;
  const [selectedChainOption, setSelectedChainOption] = useState<DropdownOption<Chain>>(DROPDOWN_OPTIONS[0]);
  const [pendingChain, setPendingChain] = useState<Chain | undefined>(undefined);
  const [shouldAttemptToSwitchNetwork, setShouldAttemptToSwitchNetwork] = useState<boolean>(true);
  const { isLoading, switchNetwork } = useSwitchNetwork({
    chainId: selectedChainOption.value.id,
    onError: () => {
      setShouldAttemptToSwitchNetwork(false);
    },
    onSuccess: () => {
      setShouldAttemptToSwitchNetwork(false);
    },
  });

  useEffect(() => {
    if (!isLoading && chain?.id) {
      setSelectedChainOption(DROPDOWN_OPTIONS.find((option) => option.value.id === chain.id) ?? DROPDOWN_OPTIONS[0]);
    }
  }, [chain, isLoading]);

  useEffect(() => {
    if (!isLoading && shouldAttemptToSwitchNetwork && pendingChain) {
      switchNetwork?.(pendingChain.id);
    }
  }, [shouldAttemptToSwitchNetwork, isLoading, switchNetwork, pendingChain]);

  return (
    <div>
      <Dropdown<Chain>
        options={DROPDOWN_OPTIONS}
        selectedOption={selectedChainOption}
        onSelect={(option: DropdownOption<Chain>) => {
          setPendingChain(option.value);
          setShouldAttemptToSwitchNetwork(true);
        }}
        small={true}
      />
    </div>
  );
}
