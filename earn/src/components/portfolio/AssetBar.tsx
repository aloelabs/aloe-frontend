import React, { useEffect } from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import useHover from 'shared/lib/data/hooks/UseHover';
import styled from 'styled-components';

import { GetTokenData, TokenData } from '../../data/TokenData';

export type AssetBarItem = {
  token: TokenData;
  percentage: number;
  color?: string;
};

const Container = styled.div`
  width: 100%;
  height: 64px;
`;

const AssetChunkContainer = styled.div.attrs((props: { percentage: number; color: string }) => props)`
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: ${(props) => props.percentage * 100}%;
  height: 100%;
  background-color: ${(props) => props.color};
  cursor: pointer;

  &:first-child {
    border-radius: 8px 0 0 8px;
  }

  &:last-child {
    border-radius: 0 8px 8px 0;
  }

  &.active {
    z-index: 1;
    transform: scale(1.04);
    box-shadow: 0px 0px 4px 0.25px ${(props) => props.color}, 0px 0px 4px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s ease-in-out, border-radius 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  }
`;

const AssetIcon = styled.img`
  width: 40px;
  height: 40px;
`;

type AssetChunkProps = {
  token: TokenData;
  percentage: number;
  active: boolean;
  onHover: () => void;
  onLeave: () => void;
  color?: string;
};

function AssetChunk(props: AssetChunkProps) {
  const { token, percentage, active, onHover, onLeave, color } = props;
  const containerRef = React.useRef<HTMLDivElement>(null);
  useHover(containerRef, onHover, onLeave);

  return (
    <AssetChunkContainer
      percentage={percentage}
      color={color || 'transparent'}
      className={active ? 'active' : ''}
      ref={containerRef}
    >
      <AssetIcon src={token.iconPath || ''} alt={token.ticker} width={40} height={40} />
    </AssetChunkContainer>
  );
}

export type AssetBarProps = {
  items: AssetBarItem[];
};

export default function AssetBar(props: AssetBarProps) {
  const { items } = props;
  const [activeIndex, setActiveIndex] = React.useState<number>(0);

  return (
    <Container>
      {items.map((data, index) => (
        <AssetChunk
          key={data.token.address}
          token={data.token}
          percentage={data.percentage}
          color={data.color}
          active={index === activeIndex}
          onHover={() => setActiveIndex(index)}
          onLeave={() => setActiveIndex(0)}
        />
      ))}
    </Container>
  );
}
