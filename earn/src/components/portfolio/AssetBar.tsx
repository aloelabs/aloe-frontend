import React, { useEffect, useMemo } from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import useHover from 'shared/lib/data/hooks/UseHover';
import styled from 'styled-components';

import useEffectOnce from '../../data/hooks/UseEffectOnce';
import { LendingPairBalances } from '../../data/LendingPair';
import { GetTokenData, TokenData } from '../../data/TokenData';
import { TokenBalance } from '../../pages/PortfolioPage';
import { rgb } from '../../util/Colors';

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
  combinedBalances: TokenBalance[];
  tokenColors: Map<string, string>;
  setActiveAsset: (token: TokenData) => void;
};

export default function AssetBar(props: AssetBarProps) {
  const { combinedBalances, tokenColors, setActiveAsset } = props;
  const [chunks, setChunks] = React.useState<AssetChunkProps[]>([]);
  const [activeIndex, setActiveIndex] = React.useState<number>(0);
  const [isPaused, setIsPaused] = React.useState<boolean>(false);

  useEffect(() => {
    let currentIntervalId = setInterval(() => {
      if (!isPaused) {
        const updatedIndex = (activeIndex + 1) % chunks.length;
        setActiveIndex(updatedIndex);
        setActiveAsset(chunks[updatedIndex].token);
      }
    }, 3000);

    return () => {
      clearInterval(currentIntervalId);
    };
  }, [activeIndex, chunks, chunks.length, isPaused, setActiveAsset]);

  useMemo(() => {
    const totalBalance = combinedBalances.reduce((acc, cur) => acc + cur.balanceUSD, 0);
    const filteredChunks = combinedBalances.filter((chunk) => chunk.balanceUSD >= totalBalance * 0.1);
    const newTotalBalance = filteredChunks.reduce((acc, cur) => acc + cur.balanceUSD, 0);
    const newChunks = filteredChunks.map((chunk, idx) => {
      const currentColor = tokenColors.get(chunk.token.address);
      return {
        token: chunk.token,
        percentage: chunk.balanceUSD / newTotalBalance,
        active: idx === activeIndex,
        onHover: () => {
          setActiveIndex(idx);
          setActiveAsset(chunk.token);
          setIsPaused(true);
        },
        onLeave: () => {
          setActiveIndex(0);
          setActiveAsset(filteredChunks[0].token);
          setIsPaused(false);
        },
        color: currentColor !== undefined ? rgb(currentColor) : 'transparent',
      };
    });
    setChunks(newChunks);
  }, [combinedBalances, tokenColors, activeIndex, setActiveAsset]);

  return (
    <Container>
      {chunks.map((chunk, index) => (
        <AssetChunk key={index} {...chunk} />
      ))}
    </Container>
  );
}
