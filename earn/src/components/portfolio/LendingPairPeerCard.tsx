import { Dropdown, DropdownOption } from 'shared/lib/components/common/Dropdown';
import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { GetTokenData } from '../../data/TokenData';
import PortfolioPieChartWidget from './PortfolioPieChartWidget';
import PortfolioPriceChartWidget from './PriceChart';

const Container = styled.div`
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0.15rem;

  background-color: rgb(7, 13, 17);

  &::before {
    content: '';
    --angle: 0deg;
    --border-size: 0.15rem;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: var(--border-size) solid transparent;
    place-content: center;
    border-radius: 8px;

    /* Paint an image in the border */
    border-image: conic-gradient(
        from var(--angle),
        transparent 0deg 45deg,
        transparent 45deg 90deg,
        #7bd8c0 90deg 135deg,
        #7bd8c0 135deg 180deg,
        transparent 180deg 225deg,
        transparent 225deg 270deg,
        transparent 270deg 315deg,
        transparent 315deg 360deg
      )
      1 stretch;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    background-origin: border-box;
    background-clip: content-box, border-box;
    @supports (background: paint(houdini)) {
      @property --angle {
        syntax: '<angle>';
        initial-value: 0deg;
        inherits: false;
      }

      @keyframes rotate {
        to {
          --angle: 360deg;
        }
      }
      animation: rotate 1s linear infinite;
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
  display: flex;
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
  flex: 1;
  border-radius: 8px;
`;

const SmallCardBodyItem = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 16px;
  background-color: rgb(13, 23, 30);
  flex: 0.25;
  border-radius: 8px;
`;

export default function LendingPairPeerCard() {
  const options: DropdownOption[] = [{ label: 'USDC/WETH', value: 'USDC/WETH' }];
  return (
    <Container>
      <CardHeader>
        <Text size='M' color='rgba(130, 160, 182, 1)'>
          Lending Pair Peer (Collateral Asset)
        </Text>
        <Dropdown options={options} selectedOption={options[0]} onSelect={() => {}} small={true} />
      </CardHeader>
      <CardBody>
        <LargeCardBodyItem>
          <Text size='M' color='rgba(130, 160, 182, 1)'>
            Total Supply
          </Text>
          <Display size='L'>$150,011</Display>
        </LargeCardBodyItem>
        <SmallCardBodyItem>
          <Text size='M' color='rgba(130, 160, 182, 1)'>
            Users
          </Text>
          <Display size='L'>96</Display>
        </SmallCardBodyItem>
        <SmallCardBodyItem>
          <Text size='M' color='rgba(130, 160, 182, 1)'>
            Utilization
          </Text>
          <Display size='L'>69%</Display>
        </SmallCardBodyItem>
        <SmallCardBodyItem>
          <Text size='M' color='rgba(130, 160, 182, 1)'>
            IV
          </Text>
          <Display size='L'>75%</Display>
        </SmallCardBodyItem>
      </CardBody>
    </Container>
  );
}
