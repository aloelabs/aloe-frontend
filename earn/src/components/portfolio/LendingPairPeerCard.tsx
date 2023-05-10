import { useContext, useEffect, useMemo, useState } from 'react';

import { ethers } from 'ethers';
import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { formatTokenAmount, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { useProvider } from 'wagmi';

import { ChainContext } from '../../App';
import { RESPONSIVE_BREAKPOINT_SM } from '../../data/constants/Breakpoints';
import { LendingPair } from '../../data/LendingPair';
import Tooltip from '../common/Tooltip';

const Container = styled.div`
  width: 100%;
  z-index: 0;
  position: relative;
  padding: 0.2rem;
  border-radius: 8px;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    z-index: -2;
    left: -50%;
    top: -200%;
    width: 200%;
    height: 500%;
    background-color: rgb(7, 13, 17);
    background-repeat: no-repeat;
    background-size: 50% 50%, 50% 50%;
    background-position: 0 0, 100% 0, 100% 100%, 0 100%;
    background-image: linear-gradient(transparent, transparent), linear-gradient(transparent, transparent),
      linear-gradient(transparent, transparent), linear-gradient(transparent, #ffffff, #ffffff, transparent);
    animation: rotate-lending-pair-peer-card-border 2s linear 1 forwards;
  }
  &::after {
    content: '';
    position: absolute;
    z-index: -1;
    left: 4px;
    top: 4px;
    width: calc(100% - 8px);
    height: calc(100% - 8px);
    background-color: rgb(7, 13, 17);
    border-radius: 4px;
  }
  @keyframes rotate-lending-pair-peer-card-border {
    75% {
      opacity: 0.5;
    }
    100% {
      transform: rotate(1turn);
      opacity: 0;
    }
  }
`;

const PlaceAboveContainer = styled.div`
  position: absolute;
  top: 6px;
  right: 16px;
  z-index: 6;
`;

const CardHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: rgb(13, 23, 30);
  padding: 8px 16px;
  border-radius: 8px;
  height: 50px;
`;

const CardBody = styled.div`
  display: grid;
  grid-template-columns: 3fr 1fr 1fr 1fr;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  margin-top: 24px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    grid-template-columns: 1fr;
  }
`;

const LargeCardBodyItem = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 16px;
  background-color: rgb(13, 23, 30);
  border-radius: 8px;
`;

const SmallCardBodyItem = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 140px;
  padding: 16px;
  background-color: rgb(13, 23, 30);
  border-radius: 8px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    width: 100%;
  }
`;

/**
 * Get the utilization and total supply of the active asset's lending pair.
 * @param activeAsset The active asset.
 * @param selectedLendingPair The selected lending pair.
 * @returns The utilization and total supply.
 */
function getActiveUtilizationAndTotalSupply(activeAsset: Token, selectedLendingPair: LendingPair): number[] {
  const activeAssetAddress = activeAsset.address;
  const token0Address = selectedLendingPair.token0.address;
  const token1Address = selectedLendingPair.token1.address;
  if (activeAssetAddress === token0Address) {
    return [selectedLendingPair.kitty0Info.utilization, selectedLendingPair.kitty0Info.inventory];
  } else if (activeAssetAddress === token1Address) {
    return [selectedLendingPair.kitty1Info.utilization, selectedLendingPair.kitty1Info.inventory];
  } else {
    return [0, 0];
  }
}

export type LendingPairPeerCardProps = {
  activeAsset: Token;
  lendingPairs: LendingPair[];
};

export default function LendingPairPeerCard(props: LendingPairPeerCardProps) {
  const { activeAsset, lendingPairs } = props;
  const { activeChain } = useContext(ChainContext);
  const provider = useProvider({ chainId: activeChain.id });

  const [cachedData, setCachedData] = useState<Map<string, number>>(new Map());

  const options: DropdownOption<LendingPair>[] = useMemo(() => {
    return lendingPairs.map((lendingPair) => {
      return {
        label: `${lendingPair.token0.symbol || ''}/${lendingPair.token1.symbol || ''}`,
        value: lendingPair,
      };
    });
  }, [lendingPairs]);

  const [numberOfUsers, setNumberOfUsers] = useState(0);
  const [selectedOption, setSelectedOption] = useState<DropdownOption<LendingPair>>(options[0]);
  useEffect(() => {
    setSelectedOption(options[0]);
  }, [options]);

  const selectedLendingPair = selectedOption.value;

  useEffect(() => {
    let mounted = true;
    const cachedResult = cachedData.get(selectedOption.label);
    if (cachedResult) {
      setNumberOfUsers(cachedResult);
      return;
    }
    // Temporarily set the number of users to 0 while we fetch the number of users
    setNumberOfUsers(0);
    // TODO: move this to a hook
    async function fetchNumberOfUsers() {
      let lender0Logs: ethers.providers.Log[] = [];
      let lender1Logs: ethers.providers.Log[] = [];
      try {
        [lender0Logs, lender1Logs] = await Promise.all([
          provider.getLogs({
            fromBlock: 0,
            toBlock: 'latest',
            address: selectedLendingPair.kitty0.address,
            topics: ['0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7'],
          }),
          provider.getLogs({
            fromBlock: 0,
            toBlock: 'latest',
            address: selectedLendingPair.kitty1.address,
            topics: ['0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7'],
          }),
        ]);
      } catch (error) {
        console.error(error);
      }
      if (lender0Logs.length === 0 && lender1Logs.length === 0) {
        return;
      }
      let uniqueUsers = new Set<string>();
      const logs = [...lender0Logs, ...lender1Logs];
      logs.forEach((log: ethers.providers.Log) => {
        if (log.topics.length < 3) return;
        const userAddress = `0x${log.topics[2].slice(26)}`;
        uniqueUsers.add(userAddress);
      });
      if (mounted) {
        setNumberOfUsers(uniqueUsers.size);
        setCachedData((cachedData) => {
          // TODO: Make this into a custom hook (and make it more efficient)
          return new Map(cachedData).set(selectedOption.label, uniqueUsers.size);
        });
      }
    }
    fetchNumberOfUsers();
    return () => {
      mounted = false;
    };
  }, [selectedLendingPair, activeChain, cachedData, selectedOption.label, provider]);

  const [activeUtilization, activeTotalSupply] = getActiveUtilizationAndTotalSupply(activeAsset, selectedLendingPair);

  return (
    <>
      <Container key={activeAsset.address + selectedLendingPair.kitty0.address}>
        <CardHeader>
          <Text size='S' color='rgba(130, 160, 182, 1)' className='flex items-center gap-2'>
            Lending Pair Peer
            <Tooltip buttonSize='S' content='Collateral Asset' position='bottom-center' />
          </Text>
        </CardHeader>
        <CardBody>
          <LargeCardBodyItem>
            <Text size='S' weight='bold' color='rgba(130, 160, 182, 1)'>
              Total Supply
            </Text>
            <div>
              <Display size='L' className='inline-block mr-0.5'>
                {formatTokenAmount(activeTotalSupply)}
              </Display>
              <Display size='S' className='inline-block ml-0.5'>
                {activeAsset?.symbol || ''}
              </Display>
            </div>
          </LargeCardBodyItem>
          <SmallCardBodyItem>
            <Text size='S' weight='bold' color='rgba(130, 160, 182, 1)'>
              Users
            </Text>
            <Display size='L'>{numberOfUsers}</Display>
          </SmallCardBodyItem>
          <SmallCardBodyItem>
            <Text size='S' weight='bold' color='rgba(130, 160, 182, 1)'>
              Utilization
            </Text>
            <Display size='L'>{roundPercentage(activeUtilization)}%</Display>
          </SmallCardBodyItem>
          <SmallCardBodyItem>
            <Text size='S' weight='bold' color='rgba(130, 160, 182, 1)'>
              IV
            </Text>
            <Display size='L'>{roundPercentage(selectedLendingPair.iv, 1)}%</Display>
          </SmallCardBodyItem>
        </CardBody>
      </Container>
      <PlaceAboveContainer>
        <Dropdown options={options} selectedOption={selectedOption} onSelect={setSelectedOption} small={true} />
      </PlaceAboveContainer>
    </>
  );
}
