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
  color: string;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
};

function AssetChunk(props: AssetChunkProps) {
  const { token, percentage, active, onClick, onHover, onLeave, color } = props;
  const containerRef = React.useRef<HTMLDivElement>(null);
  useHover(containerRef, onHover, onLeave);

  return (
    <AssetChunkContainer
      percentage={percentage}
      color={color}
      className={active ? 'active' : ''}
      onClick={onClick}
      ref={containerRef}
    >
      <AssetIcon src={token.iconPath || ''} alt={token.ticker} width={40} height={40} />
    </AssetChunkContainer>
  );
}

export type AssetBarProps = {
  combinedBalances: TokenBalance[];
  tokenColors: Map<string, string>;
  setActiveAsset: (token: TokenData) => void;
};

export default function AssetBar(props: AssetBarProps) {
  const { combinedBalances, tokenColors, setActiveAsset } = props;
  const [chunks, setChunks] = React.useState<AssetChunkProps[]>([]);
  const [defaultIndex, setDefaultIndex] = React.useState<number>(0);
  const [activeIndex, setActiveIndex] = React.useState<number>(0);
  const [isHovering, setIsHovering] = React.useState<boolean>(false);

  const combinedTokenBalances = useMemo(() => {
    const balances: Map<string, TokenBalance> = new Map();
    combinedBalances.forEach((balance) => {
      const tokenAddress = balance.token.referenceAddress || balance.token.address;
      const existingBalance = balances.get(tokenAddress);
      if (balances.has(tokenAddress)) {
        existingBalance!.balanceUSD += balance.balanceUSD;
      } else {
        balances.set(balance.token.referenceAddress || balance.token.address, balance);
      }
    });
    return Array.from(balances.values());
  }, [combinedBalances]);

  useEffect(() => {
    if (chunks.length > 0 && !isHovering) {
      setActiveIndex(defaultIndex);
      setActiveAsset(chunks[defaultIndex].token);
    }
  }, [chunks, chunks.length, defaultIndex, isHovering, setActiveAsset]);

  useMemo(() => {
    const totalBalance = combinedTokenBalances.reduce((acc, cur) => acc + cur.balanceUSD, 0);
    const filteredChunks = combinedTokenBalances.filter((chunk) => chunk.balanceUSD >= totalBalance * 0.1);
    const newTotalBalance = filteredChunks.reduce((acc, cur) => acc + cur.balanceUSD, 0);

    const newChunks = filteredChunks.map((chunk, idx) => {
      const currentColor = tokenColors.get(chunk.token.address);
      return {
        token: chunk.token,
        percentage: chunk.balanceUSD / newTotalBalance || 0,
        active: idx === activeIndex,
        color: currentColor !== undefined ? rgb(currentColor) : 'transparent',
        onClick: () => {
          setDefaultIndex(idx);
        },
        onHover: () => {
          setIsHovering(true);
          setActiveIndex(idx);
          setActiveAsset(chunk.token);
        },
        onLeave: () => {
          setActiveIndex(defaultIndex);
          setActiveAsset(filteredChunks[defaultIndex].token);
          setIsHovering(false);
        },
      };
    });
    setChunks(newChunks);
  }, [combinedTokenBalances, tokenColors, activeIndex, setActiveAsset, defaultIndex]);

  return (
    <Container>
      {chunks.map((chunk, index) => (
        <AssetChunk key={index} {...chunk} />
      ))}
    </Container>
  );
}
