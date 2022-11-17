import { useEffect, useMemo, useState } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { LendingPair } from '../../data/LendingPair';
import { getReferenceAddress, TokenData } from '../../data/TokenData';
import { formatTokenAmount, roundPercentage } from '../../util/Numbers';

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
`;

const CardBody = styled.div`
  display: grid;
  grid-template-columns: 3fr 1fr 1fr 1fr;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  margin-top: 24px;
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
`;

/**
 * Get the utilization and total supply of the active asset's lending pair.
 * @param activeAsset The active asset.
 * @param selectedLendingPair The selected lending pair.
 * @returns The utilization and total supply.
 */
function getActiveUtilizationAndTotalSupply(activeAsset: TokenData, selectedLendingPair: LendingPair): number[] {
  const activeAssetAddress = getReferenceAddress(activeAsset);
  const token0Address = getReferenceAddress(selectedLendingPair.token0);
  const token1Address = getReferenceAddress(selectedLendingPair.token1);
  if (activeAssetAddress === token0Address) {
    return [selectedLendingPair.kitty0Info.utilization, selectedLendingPair.kitty0Info.inventory];
  } else if (activeAssetAddress === token1Address) {
    return [selectedLendingPair.kitty1Info.utilization, selectedLendingPair.kitty1Info.inventory];
  } else {
    return [0, 0];
  }
}

export type LendingPairPeerCardProps = {
  lendingPairs: LendingPair[];
  activeAsset: TokenData;
};

export default function LendingPairPeerCard(props: LendingPairPeerCardProps) {
  const { lendingPairs, activeAsset } = props;
  const options: DropdownOption<LendingPair>[] = useMemo(() => {
    return lendingPairs.map((lendingPair) => {
      return {
        label: `${lendingPair.token0.ticker || ''}/${lendingPair.token1.ticker || ''}`,
        value: lendingPair,
      };
    });
  }, [lendingPairs]);

  const [selectedOption, setSelectedOption] = useState<DropdownOption<LendingPair>>(options[0]);
  useEffect(() => {
    setSelectedOption(options[0]);
  }, [options]);

  const selectedLendingPair = selectedOption.value;

  const [activeUtilization, activeTotalSupply] = getActiveUtilizationAndTotalSupply(activeAsset, selectedLendingPair);

  return (
    <Container key={activeAsset.address + selectedLendingPair.kitty0.address}>
      <CardHeader>
        <Text size='M' color='rgba(130, 160, 182, 1)'>
          Lending Pair Peer (Collateral Asset)
        </Text>
        <Dropdown options={options} selectedOption={selectedOption} onSelect={setSelectedOption} small={true} />
      </CardHeader>
      <CardBody>
        <LargeCardBodyItem>
          <Text size='M' weight='bold' color='rgba(130, 160, 182, 1)'>
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
          <Text size='M' weight='bold' color='rgba(130, 160, 182, 1)'>
            Users
          </Text>
          <Display size='L'>69</Display>
        </SmallCardBodyItem>
        <SmallCardBodyItem>
          <Text size='M' weight='bold' color='rgba(130, 160, 182, 1)'>
            Utilization
          </Text>
          <Display size='L'>{roundPercentage(activeUtilization)}%</Display>
        </SmallCardBodyItem>
        <SmallCardBodyItem>
          <Text size='M' weight='bold' color='rgba(130, 160, 182, 1)'>
            IV
          </Text>
          <Display size='L'>75%</Display>
        </SmallCardBodyItem>
      </CardBody>
    </Container>
  );
}
