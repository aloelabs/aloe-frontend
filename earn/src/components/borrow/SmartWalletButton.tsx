import React, { useEffect, useState } from 'react';

import { Display } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import styled from 'styled-components';

import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';
import { getProminentColor, rgba } from '../../util/Colors';
import TokenPairIcons from '../common/TokenPairIcons';

export const Container = styled.button.attrs((props: { backgroundGradient: string; active: boolean }) => props)`
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
  isActive: boolean;
  onClick: () => void;
};

export default function SmartWalletButton(props: SmartWalletButtonProps) {
  const { token0, token1, isActive, onClick } = props;
  const [token0Color, setToken0Color] = useState<string>('');
  const [token1Color, setToken1Color] = useState<string>('');
  useEffect(() => {
    let mounted = true;
    getProminentColor(token0.logoURI || '').then((color) => {
      if (mounted) {
        setToken0Color(color);
      }
    });
    getProminentColor(token1.logoURI || '').then((color) => {
      if (mounted) {
        setToken1Color(color);
      }
    });
    return () => {
      mounted = false;
    };
  });
  // Create the variables for the gradients.
  const buttonBackgroundGradient = `linear-gradient(90deg, ${rgba(token0Color, 0.25)} 0%, ${rgba(
    token1Color,
    0.25
  )} 100%)`;

  return (
    <Container backgroundGradient={buttonBackgroundGradient} active={isActive} onClick={onClick}>
      <div className='flex items-center gap-4'>
        <TokenPairIcons
          token0IconPath={token0.logoURI}
          token1IconPath={token1.logoURI}
          token0AltText={`${token0.name}'s Icon`}
          token1AltText={`${token1.name}'s Icon`}
        />
        <Display size='S' weight='semibold'>
          {token0.symbol} / {token1.symbol}
        </Display>
      </div>
    </Container>
  );
}

export type NewSmartWalletButtonProps = {
  onClick: () => void;
};

export function NewSmartWalletButton(props: NewSmartWalletButtonProps) {
  const { onClick } = props;
  return (
    <Container backgroundGradient={'transparent'} active={false} onClick={onClick}>
      <div className='flex items-center gap-4 m-auto'>
        <PlusIconWrapper>
          <PlusIcon />
        </PlusIconWrapper>
        <Display size='S' weight='semibold'>
          New
        </Display>
      </div>
    </Container>
  );
}
