import { useContext } from 'react';

import OpenIcon from 'shared/lib/assets/svg/Open';
import { OutlinedWhiteButton } from 'shared/lib/components/common/Buttons';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_700, GREY_800 } from 'shared/lib/data/constants/Colors';
import { FeeTier, PrintFeeTier } from 'shared/lib/data/FeeTier';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';
import styled from 'styled-components';

import { ChainContext } from '../../App';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const GREEN_COLOR = 'rgba(0, 189, 63, 1)';
const YELLOW_COLOR = 'rgba(242, 201, 76, 1)';
const RED_COLOR = 'rgba(234, 87, 87, 0.75)';

function getManipulationColor(manipulationMetric: number, manipulationThreshold: number) {
  // If the manipulation metric is greater than or equal to the threshold, the color is red.
  // If the manipulation metric is less than the threshold, but is within 20% of the threshold,
  // the color is yellow.
  // Otherwise, the color is green.
  if (manipulationMetric >= manipulationThreshold) {
    return RED_COLOR;
  } else if (manipulationMetric >= manipulationThreshold * 0.8) {
    return YELLOW_COLOR;
  } else {
    return GREEN_COLOR;
  }
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Container = styled.div`
  display: flex;
  flex-direction: row;
  gap: 24px;
  width: fit-content;
  background-color: ${GREY_800};
  border: 2px solid ${GREY_700};
  border-radius: 8px;
  padding: 20px;
`;

const OpenIconLink = styled.a`
  svg {
    path {
      stroke: ${SECONDARY_COLOR};
    }
  }
`;

export type MarketCardProps = {
  nSigma: number;
  ltv: number;
  ante: GN;
  manipulationMetric: number;
  manipulationThreshold: number;
  lenderSymbols: [string, string];
  poolAddress: string;
  feeTier: FeeTier;
};

export default function MarketCard(props: MarketCardProps) {
  const { nSigma, ltv, ante, manipulationMetric, manipulationThreshold, lenderSymbols, poolAddress, feeTier } = props;
  const { activeChain } = useContext(ChainContext);

  const token0Symbol = lenderSymbols[0].slice(0, lenderSymbols[0].length - 1);
  const token1Symbol = lenderSymbols[1].slice(0, lenderSymbols[1].length - 1);

  const manipulationColor = getManipulationColor(manipulationMetric, manipulationThreshold);
  const manipulationInequality = manipulationMetric < manipulationThreshold ? '<' : '>';

  const etherscanLink = `${getEtherscanUrlForChain(activeChain)}/address/${poolAddress}`;

  return (
    <Wrapper>
      <div className='flex gap-2 items-center'>
        <Text size='M' weight='bold'>
          Uniswap Pool - {token0Symbol}/{token1Symbol} {PrintFeeTier(feeTier)}
        </Text>
        <OpenIconLink href={etherscanLink} target='_blank' rel='noreferrer'>
          <OpenIcon width={20} height={20} />
        </OpenIconLink>
      </div>
      <Container>
        <div className='flex flex-col gap-2 flex-grow'>
          <div className='text-center'>
            <Text size='M' color={SECONDARY_COLOR}>
              Ante
            </Text>
            <div className='flex justify-center items-end gap-1'>
              <Display size='S'>{ante.toString(GNFormat.LOSSY_HUMAN)}</Display>
              <Text size='XS'>ETH</Text>
            </div>
          </div>
          <div className='text-center'>
            <Text size='M' color={SECONDARY_COLOR}>
              N Sigma
            </Text>
            <div>
              <Display size='S'>{nSigma}</Display>
            </div>
          </div>
        </div>
        <div className='flex flex-col gap-2'>
          <div className='text-center'>
            <Text size='M' color={SECONDARY_COLOR}>
              LTV
            </Text>
            <div className='flex items-center justify-center'>
              <Display size='S'>{(ltv * 100).toFixed(2)}</Display>
              <Text size='XS'>%</Text>
            </div>
          </div>
          <div className='text-center'>
            <Text size='M' color={SECONDARY_COLOR}>
              Oracle Manipulation
            </Text>
            <div className='flex justify-center items-center gap-1'>
              <Display size='S' color={manipulationColor}>
                {manipulationMetric.toFixed(0)}
              </Display>
              <Text size='S'>{manipulationInequality}</Text>
              <Display size='S'>{manipulationThreshold.toFixed(0)}</Display>
            </div>
          </div>
        </div>
        <div className='flex flex-col gap-2'>
          <div className='text-center'>
            <Text size='M' color={SECONDARY_COLOR}>
              Last Updated
            </Text>
            <div>
              <Text size='M'>6 hours ago</Text>
            </div>
          </div>
          <div className='text-center'>
            <Text size='M' color={SECONDARY_COLOR}>
              Borrowing
            </Text>
            <div className='flex justify-center'>
              <OutlinedWhiteButton size='S' disabled={true}>
                Enabled
              </OutlinedWhiteButton>
            </div>
          </div>
        </div>
      </Container>
    </Wrapper>
  );
}
