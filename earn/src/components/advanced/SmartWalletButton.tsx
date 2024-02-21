import TokenIcons from 'shared/lib/components/common/TokenIcons';
import { Display } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import styled from 'styled-components';

import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';
import useProminentColor from '../../data/hooks/UseProminentColor';
import { rgba } from '../../util/Colors';

const Container = styled.button.attrs(
  (props: { backgroundGradient: string; active: boolean; $animate: boolean }) => props
)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 8px 16px;
  gap: 8px;
  border-radius: 8px;
  background: ${(props) => (props.active ? props.backgroundGradient : 'none')};
  opacity: ${(props) => (props.active ? 1 : 0.25)};
  filter: ${(props) => (props.active ? 'none' : 'grayscale(100%)')};
  cursor: pointer;

  &:hover {
    background: ${(props) => props.backgroundGradient};
    filter: none;
    opacity: 1;
  }

  ${(props) => {
    if (props.$animate) {
      return `
        animation: pulse 2s infinite;
        background: ${props.backgroundGradient};
        filter: none;
        opacity: 1;
      `;
    }
  }}

  @keyframes pulse {
    0% {
      background: rgba(255, 255, 255, 0.25);
      box-shadow: 0px 0px 0px 0px rgba(255, 255, 255, 0.5);
    }
    50% {
      background: rgba(255, 255, 255, 0.25);
      box-shadow: 0px 0px 0px 4px rgba(255, 255, 255, 0);
    }
    100% {
      background: rgba(255, 255, 255, 0.25);
      box-shadow: 0px 0px 0px 0px rgba(255, 255, 255, 0.5);
    }
  }
`;

const PlusIconWrapper = styled.div`
  border: 1px solid #ffffff;
  border-radius: 50%;
  svg {
    path {
      stroke: #ffffff;
    }
  }
`;

export type SmartWalletButtonProps = {
  token0: Token;
  token1: Token;
  tokenId: number | null;
  isActive: boolean;
  onClick: () => void;
};

export default function SmartWalletButton(props: SmartWalletButtonProps) {
  const { token0, token1, tokenId, isActive, onClick } = props;
  const token0Color = useProminentColor(token0.logoURI);
  const token1Color = useProminentColor(token1.logoURI);
  // Create the variables for the gradients.
  const buttonBackgroundGradient = `linear-gradient(90deg, ${rgba(token0Color, 0.25)} 0%, ${rgba(
    token1Color,
    0.25
  )} 100%)`;

  return (
    <Container backgroundGradient={buttonBackgroundGradient} active={isActive} onClick={onClick}>
      <div className='flex items-center gap-4 min-w-max'>
        <TokenIcons tokens={[token0, token1]} width={16} height={16} />
        <Display size='XS'>
          {token0.symbol} / {token1.symbol}
          {tokenId === null ? '' : ` (#${tokenId})`}
        </Display>
      </div>
    </Container>
  );
}

export type NewSmartWalletButtonProps = {
  userHasNoMarginAccounts: boolean;
  onClick: () => void;
};

export function NewSmartWalletButton(props: NewSmartWalletButtonProps) {
  const { userHasNoMarginAccounts, onClick } = props;
  return (
    <Container backgroundGradient={'transparent'} active={false} onClick={onClick} $animate={userHasNoMarginAccounts}>
      <div className='flex items-center gap-4 min-w-[220px]'>
        <PlusIconWrapper>
          <PlusIcon width='16px' height='16px' />
        </PlusIconWrapper>
        <Display size='XS'>Create</Display>
      </div>
    </Container>
  );
}
