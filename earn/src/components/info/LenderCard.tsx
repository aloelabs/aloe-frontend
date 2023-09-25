import { useContext } from 'react';

import OpenIcon from 'shared/lib/assets/svg/Open';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { GREY_700, GREY_800 } from 'shared/lib/data/constants/Colors';
import { GN } from 'shared/lib/data/GoodNumber';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';
import styled from 'styled-components';
import { Address } from 'wagmi';

import { ChainContext } from '../../App';
import { ALOE_II_RATE_MODEL_NAMES } from '../../data/constants/Values';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: fit-content;
  background-color: ${GREY_800};
  border: 2px solid ${GREY_700};
  border-radius: 8px;
  padding: 20px;
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

export type LenderCardProps = {
  address: Address;
  symbol: string;
  reserveFactor: number;
  totalSupply: GN;
  rateModel: Address;
  decimals: number;
};

export default function LenderCard(props: LenderCardProps) {
  const { address, symbol, reserveFactor, rateModel } = props;
  const { activeChain } = useContext(ChainContext);

  const etherscanLink = `${getEtherscanUrlForChain(activeChain)}/address/${address}`;
  const rateModelName = ALOE_II_RATE_MODEL_NAMES[rateModel.toLowerCase()];

  return (
    <Wrapper>
      <div className='flex gap-2 items-center'>
        <Text size='M' weight='bold'>
          {symbol}
        </Text>
        <OpenIconLink href={etherscanLink} target='_blank' rel='noreferrer'>
          <OpenIcon width={20} height={20} />
        </OpenIconLink>
      </div>
      <Container>
        <div className='text-center'>
          <Text size='M' color={SECONDARY_COLOR}>
            Rate Model
          </Text>
          <Text size='M'>{rateModelName}</Text>
        </div>
        <div className='text-center'>
          <Text size='M' color={SECONDARY_COLOR}>
            Reserve Factor
          </Text>
          <div className='flex items-center justify-center'>
            <Display size='S'>{reserveFactor.toFixed(2)}</Display>
            <Text size='XS'>%</Text>
          </div>
        </div>
      </Container>
    </Wrapper>
  );
}
