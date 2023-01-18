import { useContext, useEffect, useMemo, useState } from 'react';

import { AxiosResponse } from 'axios';
import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { ChainContext } from '../../App';
import { RESPONSIVE_BREAKPOINT_SM } from '../../data/constants/Breakpoints';
import { LendingPair } from '../../data/LendingPair';
import { Token } from '../../data/Token';
import { makeEtherscanRequest } from '../../util/Etherscan';
import { formatTokenAmount, roundPercentage } from '../../util/Numbers';
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
  const options: DropdownOption<LendingPair>[] = useMemo(() => {
    return lendingPairs.map((lendingPair) => {
      return {
        label: `${lendingPair.token0.ticker || ''}/${lendingPair.token1.ticker || ''}`,
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
    async function fetchNumberOfUsers() {
      const etherscanRequestLender0 = makeEtherscanRequest(
        7537163,
        selectedLendingPair.kitty0.address,
        ['0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7'],
        true,
        activeChain
      );
      const etherscanRequestLender1 = makeEtherscanRequest(
        7537163,
        selectedLendingPair.kitty1.address,
        ['0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7'],
        true,
        activeChain
      );
      let etherscanResultLender0: AxiosResponse<any, any> | null = null;
      let etherscanResultLender1: AxiosResponse<any, any> | null = null;
      try {
        [etherscanResultLender0, etherscanResultLender1] = await Promise.all([
          etherscanRequestLender0,
          etherscanRequestLender1,
        ]);
      } catch (error) {
        console.error(error);
      }
      if (
        etherscanResultLender0 == null ||
        !Array.isArray(etherscanResultLender0.data.result) ||
        etherscanResultLender1 == null ||
        !Array.isArray(etherscanResultLender1.data.result)
      )
        return;
      let uniqueUsers = new Set<string>();
      const results = [...etherscanResultLender0.data.result, ...etherscanResultLender1.data.result];
      results.forEach((result: any) => {
        if (result.topics.length < 3) return;
        const userAddress = `0x${result.topics[2].slice(26)}`;
        uniqueUsers.add(userAddress);
      });
      if (mounted) {
        setNumberOfUsers(uniqueUsers.size);
      }
    }
    fetchNumberOfUsers();
    return () => {
      mounted = false;
    };
  }, [selectedLendingPair, activeChain]);

  const [activeUtilization, activeTotalSupply] = getActiveUtilizationAndTotalSupply(activeAsset, selectedLendingPair);

  return (
    <Container key={activeAsset.address + selectedLendingPair.kitty0.address}>
      <CardHeader>
        <Text size='S' color='rgba(130, 160, 182, 1)' className='flex items-center gap-2'>
          Lending Pair Peer
          <Tooltip buttonSize='S' content='Collateral Asset' position='bottom-center' />
        </Text>
        <Dropdown options={options} selectedOption={selectedOption} onSelect={setSelectedOption} small={true} />
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
              {activeAsset?.ticker || ''}
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
          <Display size='L'>75%</Display>
        </SmallCardBodyItem>
      </CardBody>
    </Container>
  );
}
