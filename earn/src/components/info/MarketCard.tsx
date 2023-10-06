import { useContext } from 'react';

import { formatDistanceToNowStrict, format } from 'date-fns';
import { factoryAbi } from 'shared/lib/abis/Factory';
import OpenIcon from 'shared/lib/assets/svg/OpenNoPad';
import { OutlinedWhiteButton } from 'shared/lib/components/common/Buttons';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_FACTORY_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GREY_700, GREY_800 } from 'shared/lib/data/constants/Colors';
import { Q32 } from 'shared/lib/data/constants/Values';
import { FeeTier, PrintFeeTier } from 'shared/lib/data/FeeTier';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';
import styled from 'styled-components';
import { Address, useContractWrite, usePrepareContractWrite } from 'wagmi';

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
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Cell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
`;

const PausedStatus = styled.div<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${(props) => props.$color};
`;

export type MarketCardProps = {
  nSigma: number;
  ltv: number;
  ante: GN;
  pausedUntilTime: number;
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
    pausedUntilTime,
    manipulationMetric,
    manipulationThreshold,
    lenderSymbols,
    poolAddress,
    feeTier,
    lastUpdatedTimestamp,
  } = props;
  const { activeChain } = useContext(ChainContext);

  const etherscanLink = `${getEtherscanUrlForChain(activeChain)}/address/${poolAddress}`;
  const token0Symbol = lenderSymbols[0].slice(0, lenderSymbols[0].length - 1);
  const token1Symbol = lenderSymbols[1].slice(0, lenderSymbols[1].length - 1);

  const manipulationColor = getManipulationColor(manipulationMetric, manipulationThreshold);
  const manipulationInequality = manipulationMetric < manipulationThreshold ? '<' : '>';

  const lastUpdated = lastUpdatedTimestamp
    ? formatDistanceToNowStrict(new Date(lastUpdatedTimestamp * 1000), { addSuffix: true, roundingMethod: 'round' })
    : 'Never';
  const minutesSinceLastUpdate = lastUpdatedTimestamp ? (Date.now() / 1000 - lastUpdatedTimestamp) / 60 : 0;
  const canUpdateLTV = minutesSinceLastUpdate > 60;

  const isPaused = pausedUntilTime > Date.now() / 1000;
  const canBorrowingBeDisabled = manipulationMetric >= manipulationThreshold;

  const { config: pauseConfig } = usePrepareContractWrite({
    address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
    abi: factoryAbi,
    functionName: 'pause',
    // We don't care as much about gas here as we prioritize it working
    args: [poolAddress as Address, Q32],
    enabled: canBorrowingBeDisabled,
    chainId: activeChain.id,
  });

  const gasLimit = pauseConfig.request?.gasLimit.mul(110).div(100);

  const { write: pause, isLoading: contractIsLoading } = useContractWrite({
    ...pauseConfig,
    request: {
      ...pauseConfig.request,
      gasLimit,
    },
  });

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
              Last Updated: {lastUpdated}
            </Text>
            <div className='flex justify-center mt-[-2px] mb-[-4px]'>
              <OutlinedWhiteButton size='S' disabled={!canUpdateLTV}>
                Update LTV
              </OutlinedWhiteButton>
            </div>
          </Cell>
          <Cell>
            <div className='flex items-center gap-1.5'>
              <Text size='S' weight='bold' color={SECONDARY_COLOR}>
                Borrows: {isPaused ? `Paused Until ${format(pausedUntilTime * 1000, 'h:mmaaa')}` : 'Enabled'}
              </Text>
              <PausedStatus $color={isPaused ? RED_COLOR : GREEN_COLOR} />
            </div>
            <div className='flex justify-center mt-[-2px] mb-[-4px]'>
              <OutlinedWhiteButton size='S' disabled={!contractIsLoading && !canBorrowingBeDisabled} onClick={pause}>
                {contractIsLoading ? 'Loading' : isPaused ? 'Extend Pause' : 'Pause'}
              </OutlinedWhiteButton>
            </div>
          </Cell>
        </Column>
      </Container>
    </Wrapper>
  );
}
