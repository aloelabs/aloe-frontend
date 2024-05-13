import { useEffect, useState, useRef } from 'react';
import {
  DropdownOption,
  DropdownHeader,
  DropdownListWrapper,
  DropdownOptionContainer,
  DropdownWrapper,
  DropdownList,
} from '../common/Dropdown';
import DropdownArrowDown from '../../assets/svg/DropdownArrowDown';
import DropdownArrowUp from '../../assets/svg/DropdownArrowUp';
import { CHAIN_LOGOS, SUPPORTED_CHAINS } from '../../data/constants/ChainSpecific';
import styled from 'styled-components';
import { Text } from '../common/Typography';
import { classNames } from '../../util/ClassNames';
import { AltSpinner } from '../common/Spinner';
import useClickOutside from '../../data/hooks/UseClickOutside';
import { useChainId, useSwitchChain } from 'wagmi';
import { Chain } from 'viem';

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
    background-color: rgba(255, 255, 255, 0.05);
  }
`;

export type ChainSelectorProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export default function ChainSelector(props: ChainSelectorProps) {
  const { isOpen, setIsOpen } = props;
  const [selectedChainOption, setSelectedChainOption] = useState<DropdownOption<Chain>>(DROPDOWN_OPTIONS[0]);
  const [pendingChainOption, setPendingChainOption] = useState<DropdownOption<Chain> | undefined>(undefined);

  const chainId = useChainId();
  const { isPending, switchChainAsync } = useSwitchChain();

  useEffect(() => {
    if (isPending) return;
    setSelectedChainOption(DROPDOWN_OPTIONS.find((option) => option.value.id === chainId) ?? DROPDOWN_OPTIONS[0]);
  }, [chainId, isPending]);

  // useEffect(() => {
  //   if (!isPending && shouldAttemptToSwitchNetwork && pendingChainOption) {
  //     const newChain = pendingChainOption.value;
  //     switchChainAsync({ chainId: newChain.id })
  //       .then(() => {
  //         setActiveChain(newChain);
  //       })
  //       .finally(() => {
  //         setShouldAttemptToSwitchNetwork(false);
  //         setIsOpen(false);
  //         setPendingChainOption(undefined);
  //       });
  //   }
  // }, [shouldAttemptToSwitchNetwork, isPending, switchChainAsync, pendingChainOption, setActiveChain, setIsOpen]);

  const dropdownRef = useRef(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  return (
    <DropdownWrapper ref={dropdownRef}>
      <DropdownHeader
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        size={'S'}
      >
        <div className='flex items-center gap-3'>
          {selectedChainOption.icon && (
            <div className='w-4 h-4 bg-transparent rounded-8'>{selectedChainOption.icon}</div>
          )}
        </div>
        {isOpen ? (
          <DropdownArrowUp className='w-4 absolute right-3 pointer-events-none' />
        ) : (
          <DropdownArrowDown className='w-4 absolute right-3 pointer-events-none' />
        )}
      </DropdownHeader>
      {isOpen && (
        <DropdownListWrapper>
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
                  if (pendingChainOption?.value !== undefined) return;
                  // If the user is offline, set the chain
                  setPendingChainOption(option);
                  switchChainAsync({ chainId: option.value.id })
                    .then(() => {
                      setSelectedChainOption(option);
                      setIsOpen(false);
                    })
                    .finally(() => setPendingChainOption(undefined));
                }}
              >
                <div className='flex items-center gap-3'>
                  {option.icon && <div className='w-4 h-4 bg-transparent rounded-8'>{option.icon}</div>}
                  <Text size='XS'>{option.label}</Text>
                  <div className='relative w-4 h-4 ml-auto'>
                    {option.value === pendingChainOption?.value && <AltSpinner size='XS' />}
                  </div>
                </div>
              </StyledDropdownOptionContainer>
            ))}
          </DropdownList>
        </DropdownListWrapper>
      )}
    </DropdownWrapper>
  );
}
