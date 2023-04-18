import { useContext } from 'react';

import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { getEtherscanUrlForChain } from 'shared/lib/util/Chains';
import styled from 'styled-components';

import { ChainContext } from '../../../App';
import { ReactComponent as OpenIcon } from '../../../assets/svg/open.svg';
import { Kitty } from '../../../data/Kitty';
import { Token } from '../../../data/Token';
import { truncateAddress } from '../../../util/Addresses';
import TokenIcon from '../../common/TokenIcon';

const LinkSection = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
`;

const RowContainer = styled.div.attrs((props: { gap?: number }) => props)`
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${(props) => props.gap || 4}px;
`;

const StyledExternalLink = styled.a`
  display: flex;
  align-items: center;
  gap: 4px;
  &:hover {
    div {
      text-decoration: underline;
    }
  }
`;

function TokenContractInfo(props: { token: Token; baseEtherscanUrl: string; containerClassName?: string }) {
  const { token, baseEtherscanUrl, containerClassName } = props;
  return (
    <RowContainer gap={16} className={containerClassName}>
      <TokenIcon token={token} width={32} height={32} />
      <div>
        <Text size='M'>{token.ticker}</Text>
        <RowContainer>
          <StyledExternalLink href={`${baseEtherscanUrl}/address/${token.address}`} target='_blank'>
            <Text color='#C2D1DD'>{truncateAddress(token.address, 16)}</Text>
            <OpenIcon />
          </StyledExternalLink>
        </RowContainer>
      </div>
    </RowContainer>
  );
}

export type ContractLinksModalProps = {
  token0: Token;
  token1: Token;
  kitty0: Kitty;
  kitty1: Kitty;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

export default function ContractLinksModal(props: ContractLinksModalProps) {
  const { token0, token1, kitty0, kitty1, isOpen, setIsOpen } = props;
  const { activeChain } = useContext(ChainContext);
  const baseEtherscanUrl = getEtherscanUrlForChain(activeChain);
  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Contract Links'>
      <LinkSection>
        <Text size='L'>Underlying Tokens</Text>
        <TokenContractInfo token={token0} baseEtherscanUrl={baseEtherscanUrl} containerClassName='mb-2' />
        <TokenContractInfo token={token1} baseEtherscanUrl={baseEtherscanUrl} />
      </LinkSection>
      <LinkSection>
        <Text size='L'>Aloe+ Tokens</Text>
        <TokenContractInfo token={kitty0} baseEtherscanUrl={baseEtherscanUrl} containerClassName='mb-2' />
        <TokenContractInfo token={kitty1} baseEtherscanUrl={baseEtherscanUrl} />
      </LinkSection>
    </Modal>
  );
}
