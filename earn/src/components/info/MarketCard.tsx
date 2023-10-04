import { useContext } from 'react';

import { formatDistanceToNow } from 'date-fns';
import OpenIcon from 'shared/lib/assets/svg/OpenNoPad';
import { OutlinedWhiteButton } from 'shared/lib/components/common/Buttons';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_700, GREY_800 } from 'shared/lib/data/constants/Colors';
import { FeeTier, PrintFeeTier } from 'shared/lib/data/FeeTier';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';
import styled from 'styled-components';
import tw from 'twin.macro';

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
  gap: 32px;
  width: fit-content;
  background-color: ${GREY_800};
  border: 2px solid ${GREY_700};
  border-radius: 8px;
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
  padding: 20px 32px;
  flex-grow: 1;
  white-space: nowrap;
`;

const OpenIconLink = styled.a`
  svg {
    path {
      stroke: ${SECONDARY_COLOR};
    }
  }
`;

const Column = styled.div`
  ${tw`flex flex-col gap-4`}
`;

const Cell = styled.div`
  ${tw`flex flex-col gap-1 text-center`}
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
  lastUpdatedTimestamp?: number;
};

export default function MarketCard(props: MarketCardProps) {
  const {
    nSigma,
    ltv,
    ante,
    manipulationMetric,
    manipulationThreshold,
    lenderSymbols,
    poolAddress,
    feeTier,
    lastUpdatedTimestamp,
  } = props;
  const { activeChain } = useContext(ChainContext);

  const token0Symbol = lenderSymbols[0].slice(0, lenderSymbols[0].length - 1);
  const token1Symbol = lenderSymbols[1].slice(0, lenderSymbols[1].length - 1);

  const manipulationColor = getManipulationColor(manipulationMetric, manipulationThreshold);
  const manipulationInequality = manipulationMetric < manipulationThreshold ? '<' : '>';

  const etherscanLink = `${getEtherscanUrlForChain(activeChain)}/address/${poolAddress}`;

  const lastUpdated = lastUpdatedTimestamp
    ? formatDistanceToNow(new Date(lastUpdatedTimestamp * 1000), { includeSeconds: false, addSuffix: true })
    : 'Never';

  return (
    <Wrapper>
      <div className='flex gap-2 items-baseline'>
        <Text size='M' weight='medium' color={SECONDARY_COLOR}>
          {token0Symbol}/{token1Symbol} {PrintFeeTier(feeTier)}
        </Text>
        <OpenIconLink href={etherscanLink} target='_blank' rel='noreferrer'>
          <OpenIcon width={12} height={12} />
        </OpenIconLink>
      </div>
      <Container>
        <Column>
          <Cell>
            <Text size='S' weight='bold' color={SECONDARY_COLOR}>
              Ante
            </Text>
            <div className='flex justify-center items-baseline gap-1'>
              <Display size='M'>{ante.toString(GNFormat.LOSSY_HUMAN)}</Display>
              <Text size='S'>ETH</Text>
            </div>
          </Cell>
          <Cell>
            <Text size='S' weight='bold' color={SECONDARY_COLOR}>
              # Sigma
            </Text>
            <div>
              <Display size='M'>{nSigma}</Display>
            </div>
          </Cell>
        </Column>
        <Column>
          <Cell>
            <Text size='S' weight='bold' color={SECONDARY_COLOR}>
              LTV
            </Text>
            <Display size='M'>{(ltv * 100).toFixed(2)}%</Display>
          </Cell>
          <Cell>
            <Text size='S' weight='bold' color={SECONDARY_COLOR}>
              Oracle Manipulation
            </Text>
            <div className='flex justify-center items-center gap-1'>
              <Display size='M' color={manipulationColor}>
                {manipulationMetric.toFixed(0)}
              </Display>
              <Text size='M'>{manipulationInequality}</Text>
              <Display size='M'>{manipulationThreshold.toFixed(0)}</Display>
            </div>
          </Cell>
        </Column>
        <Column>
          <Cell>
            <Text size='S' weight='bold' color={SECONDARY_COLOR}>
              Last Updated
            </Text>
            <Display size='M'>{lastUpdated}</Display>
          </Cell>
          <Cell>
            <Text size='S' weight='bold' color={SECONDARY_COLOR}>
              Borrowing Status
            </Text>
            <div className='flex justify-center mt-[-2px] mb-[-4px]'>
              <OutlinedWhiteButton size='S' disabled={true}>
                Enabled
              </OutlinedWhiteButton>
            </div>
          </Cell>
        </Column>
      </Container>
    </Wrapper>
  );
}
