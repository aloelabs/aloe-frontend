import { useEffect, useMemo, useState } from 'react';

import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { LendingPair } from '../../data/LendingPair';
import { getReferenceAddress, GetTokenData, TokenData } from '../../data/TokenData';
import { formatTokenAmount, formatUSD, roundPercentage } from '../../util/Numbers';
import LeftFacingIndependentTooltip from './LeftFacingIndendentTooltip';
import PortfolioPieChartWidget from './PortfolioPieChartWidget';
import PortfolioPriceChartWidget from './PriceChart';

// const Container = styled.div`
//   width: 100%;
//   position: relative;
//   display: flex;
//   flex-direction: column;
//   padding: 0.15rem;

//   background-color: rgb(7, 13, 17);

//   &::before {
//     content: '';
//     --angle: 0deg;
//     --border-size: 0.15rem;
//     position: absolute;
//     top: 0;
//     left: 0;
//     right: 0;
//     bottom: 0;
//     border: var(--border-size) solid transparent;
//     place-content: center;
//     border-radius: 8px;

//     -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
//     -webkit-mask-composite: xor;
//     mask-composite: exclude;
//     background-origin: border-box;
//     background-clip: content-box, border-box;
//     @supports (background: paint(houdini)) {
//       @property --angle {
//         syntax: '<angle>';
//         initial-value: 0deg;
//         inherits: false;
//       }

//       @keyframes rotate {
// from {
//   border-image: conic-gradient(
//     from var(--angle),
//     transparent 0deg 45deg,
//     transparent 45deg 90deg,
//     #7bd8c0 90deg 135deg,
//     #7bd8c0 135deg 180deg,
//     transparent 180deg 225deg,
//     transparent 225deg 270deg,
//     transparent 270deg 315deg,
//     transparent 315deg 360deg
//   )
//   1 stretch;
// }
//         to {
//           --angle: 360deg;
//           /* Paint an image in the border */
//     border-image: conic-gradient(
//         from var(--angle),
//         transparent 0deg 45deg,
//         transparent 45deg 90deg,
//         #7bd8c0 90deg 135deg,
//         #7bd8c0 135deg 180deg,
//         transparent 180deg 225deg,
//         transparent 225deg 270deg,
//         transparent 270deg 315deg,
//         transparent 315deg 360deg
//       )
//       1 stretch;
//         }
//       }
//       animation: rotate 1s linear 1;
//     }
//   }
// `;

const Container = styled.div`
  width: 805px;
  /* height: 200px; */
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
    //linear-gradient(transparent, #7bd7c0, #7bd7c0, transparent);
    animation: rotate 2s linear 1 forwards;
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

  @keyframes rotate {
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

export type LendingPairPeerCardProps = {
  lendingPairs: LendingPair[];
  activeAsset: TokenData;
};

export default function LendingPairPeerCard(props: LendingPairPeerCardProps) {
  const { lendingPairs, activeAsset } = props;
  const options: DropdownOption[] = useMemo(() => {
    return lendingPairs.map((lendingPair) => {
      return {
        label: `${lendingPair.token0.ticker || ''}/${lendingPair.token1.ticker || ''}`,
        value: JSON.stringify(lendingPair),
      };
    });
  }, [lendingPairs]);

  const [selectedOption, setSelectedOption] = useState<DropdownOption>(options[0]);
  useEffect(() => {
    setSelectedOption(options[0]);
  }, [options]);
  const selectedLendingPair = useMemo(() => {
    return JSON.parse(selectedOption.value) as LendingPair;
  }, [selectedOption]);

  const activeUtilization = useMemo(() => {
    const activeAssetAddress = getReferenceAddress(activeAsset);
    const token0Address = getReferenceAddress(selectedLendingPair.token0);
    const token1Address = getReferenceAddress(selectedLendingPair.token1);
    if (activeAssetAddress === token0Address) {
      return selectedLendingPair.kitty0Info.utilization;
    } else if (activeAssetAddress === token1Address) {
      return selectedLendingPair.kitty1Info.utilization;
    } else {
      return 0;
    }
  }, [selectedLendingPair, activeAsset]);
  const activeTotalSupply = useMemo(() => {
    const activeAssetAddress = getReferenceAddress(activeAsset);
    const token0Address = getReferenceAddress(selectedLendingPair.token0);
    const token1Address = getReferenceAddress(selectedLendingPair.token1);
    if (activeAssetAddress === token0Address) {
      return selectedLendingPair.kitty0Info.inventory;
    } else if (activeAssetAddress === token1Address) {
      return selectedLendingPair.kitty1Info.inventory;
    } else {
      return 0;
    }
  }, [selectedLendingPair, activeAsset]);
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
