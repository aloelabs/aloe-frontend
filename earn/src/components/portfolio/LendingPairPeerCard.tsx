import { useEffect, useMemo, useState } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import Tooltip from 'shared/lib/components/common/Tooltip';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_800 } from 'shared/lib/data/constants/Colors';
import { LendingPair } from 'shared/lib/data/LendingPair';
import { Token } from 'shared/lib/data/Token';
import useChain from 'shared/lib/hooks/UseChain';
import { formatTokenAmount, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { Config, useClient } from 'wagmi';

import { RESPONSIVE_BREAKPOINT_SM } from '../../data/constants/Breakpoints';
import useNumberOfUsers from '../../data/hooks/UseNumberOfUsers';
import { useEthersProvider } from '../../util/Provider';

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
  background-color: ${GREY_800};
  padding: 8px 16px;
  border-radius: 8px;
  height: 50px;
`;

const CardBody = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 3fr) 1fr 1fr 1fr;
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
  background-color: ${GREY_800};
  border-radius: 8px;
`;

const SmallCardBodyItem = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 140px;
  padding: 16px;
  background-color: ${GREY_800};
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
    return [selectedLendingPair.kitty0Info.utilization, selectedLendingPair.kitty0Info.totalAssets.toNumber()];
  } else if (activeAssetAddress === token1Address) {
    return [selectedLendingPair.kitty1Info.utilization, selectedLendingPair.kitty1Info.totalAssets.toNumber()];
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
  const activeChain = useChain();

  const client = useClient<Config>({ chainId: activeChain.id });
  const provider = useEthersProvider(client);

  const options: DropdownOption<LendingPair>[] = useMemo(() => {
    return lendingPairs.map((lendingPair) => {
      return {
        label: `${lendingPair.token0.symbol}/${lendingPair.token1.symbol}`,
        value: lendingPair,
      };
    });
  }, [lendingPairs]);

  const [selectedOption, setSelectedOption] = useState<DropdownOption<LendingPair>>(options[0]);
  useEffect(() => {
    setSelectedOption(options[0]);
  }, [options]);

  const selectedLendingPair = selectedOption.value;

  const numberOfUsers = useNumberOfUsers(provider, selectedLendingPair, selectedOption.label);

  const [activeUtilization, activeTotalSupply] = getActiveUtilizationAndTotalSupply(activeAsset, selectedLendingPair);

  return (
    <>
      <Container key={activeAsset.address + selectedLendingPair.kitty0.address}>
        <CardHeader>
          <Text size='S' color='rgba(130, 160, 182, 1)' className='flex items-center gap-2'>
            Lending Pair Peer
            <Tooltip
              buttonSize='S'
              // eslint-disable-next-line max-len
              content='The information in this section relates to a Lending Pair. A given asset may be part of multiple Lending Pairs, so use the dropdown on the right to choose one to inspect.'
              position='bottom-center'
            />
          </Text>
        </CardHeader>
        <CardBody>
          <LargeCardBodyItem>
            <Text size='S' weight='bold' color='rgba(130, 160, 182, 1)'>
              Total Supply
            </Text>
            <div className='w-full flex whitespace-nowrap overflow-hidden items-baseline justify-center'>
              <Display
                size='L'
                className='overflow-hidden text-ellipsis whitespace-nowrap mr-0.5'
                title={formatTokenAmount(activeTotalSupply)}
              >
                {formatTokenAmount(activeTotalSupply)}
              </Display>
              <Display size='S' className='ml-0.5'>
                {activeAsset.symbol}
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
              LTV
            </Text>
            <Display size='L'>{roundPercentage(selectedLendingPair.ltv * 100, 1)}%</Display>
          </SmallCardBodyItem>
        </CardBody>
      </Container>
      <PlaceAboveContainer>
        <Dropdown options={options} selectedOption={selectedOption} onSelect={setSelectedOption} size={'M'} />
      </PlaceAboveContainer>
    </>
  );
}
