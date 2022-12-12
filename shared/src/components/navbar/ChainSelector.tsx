import { useEffect, useState, useRef } from 'react';
import {
  DropdownOption,
  DropdownHeader,
  DropdownList,
  DropdownOptionContainer,
  DropdownWrapper,
} from '../common/Dropdown';
import DropdownArrowDown from '../../assets/svg/DropdownArrowDown';
import DropdownArrowUp from '../../assets/svg/DropdownArrowUp';
import { Chain, useSwitchNetwork } from 'wagmi';
import { CHAIN_LOGOS, SUPPORTED_CHAINS } from '../../data/constants/Chains';
import styled from 'styled-components';
import { Text } from '../common/Typography';
import { classNames } from '../../util/ClassNames';
import { AltSpinner } from '../common/Spinner';
import useClickOutside from '../../data/hooks/UseClickOutside';

const DROPDOWN_OPTIONS: DropdownOption<Chain>[] = SUPPORTED_CHAINS.map((chain) => ({
  label: chain.name,
  value: chain,
  icon: CHAIN_LOGOS[chain.id],
}));

const StyledDropdownOptionContainer = styled(DropdownOptionContainer)`
  width: 100%;
  text-align: start;
  padding: 6px 12px;
  white-space: nowrap;
  border-radius: 8px;
  &.pending {
    background-color: rgba(255, 255, 255, 0.1);
  }
`;

export type ChainSelectorProps = {
  chain?: Chain;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export default function ChainSelector(props: ChainSelectorProps) {
  const { chain, isOpen, setIsOpen } = props;
  const [selectedChainOption, setSelectedChainOption] = useState<DropdownOption<Chain>>(DROPDOWN_OPTIONS[0]);
  const [pendingChainOption, setPendingChainOption] = useState<DropdownOption<Chain> | undefined>(undefined);
  const [shouldAttemptToSwitchNetwork, setShouldAttemptToSwitchNetwork] = useState<boolean>(true);
  const { isLoading, reset, switchNetwork } = useSwitchNetwork({
    chainId: selectedChainOption.value.id,
    onError: () => {
      setShouldAttemptToSwitchNetwork(false);
      setIsOpen(false);
      setPendingChainOption(undefined);
    },
    onSuccess: () => {
      setShouldAttemptToSwitchNetwork(false);
      setIsOpen(false);
      setPendingChainOption(undefined);
    },
  });

  useEffect(() => {
    if (!isLoading && chain?.id) {
      setSelectedChainOption(DROPDOWN_OPTIONS.find((option) => option.value.id === chain.id) ?? DROPDOWN_OPTIONS[0]);
    }
  }, [chain, isLoading]);

  useEffect(() => {
    if (!isLoading && shouldAttemptToSwitchNetwork && pendingChainOption) {
      switchNetwork?.(pendingChainOption.value.id);
    }
  }, [shouldAttemptToSwitchNetwork, isLoading, switchNetwork, pendingChainOption]);

  const dropdownRef = useRef(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  return (
    <DropdownWrapper ref={dropdownRef}>
      <DropdownHeader
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        small={true}
      >
        <div className='flex items-center gap-3'>
          {selectedChainOption.icon && <div className='w-4 h-4 bg-white rounded-full'>{selectedChainOption.icon}</div>}
          <Text size='XS'>{selectedChainOption.label}</Text>
        </div>
        {isOpen ? (
          <DropdownArrowUp className='w-4 absolute right-3 pointer-events-none' />
        ) : (
          <DropdownArrowDown className='w-4 absolute right-3 pointer-events-none' />
        )}
      </DropdownHeader>
      {isOpen && (
        <DropdownList small={true}>
          {DROPDOWN_OPTIONS.map((option, index) => (
            <StyledDropdownOptionContainer
              className={classNames(
                option.value === selectedChainOption.value ? 'active' : '',
                option.value === pendingChainOption?.value ? 'pending' : ''
              )}
              key={index}
              onClick={() => {
                // If the user selects the currently selected chain, do nothing
                if (option.value === selectedChainOption.value) return;
                // Reset the switch network state if the user changes their mind
                if (pendingChainOption !== undefined) reset();
                // Otherwise, set the pending chain option and attempt to switch networks
                setPendingChainOption(option);
                setShouldAttemptToSwitchNetwork(true);
              }}
            >
              <div className='flex items-center gap-3'>
                {option.icon && <div className='w-4 h-4 bg-white rounded-full'>{option.icon}</div>}
                <Text size='XS'>{option.label}</Text>
                <div className='relative w-4 h-4 ml-auto'>
                  {option.value === pendingChainOption?.value && <AltSpinner size='XS' />}
                </div>
              </div>
            </StyledDropdownOptionContainer>
          ))}
        </DropdownList>
      )}
    </DropdownWrapper>
  );
}
