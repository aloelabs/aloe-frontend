import React, { useEffect, useMemo, useState } from 'react';

import useHover from 'shared/lib/data/hooks/UseHover';
import styled from 'styled-components';

import { getReferenceAddress, TokenData } from '../../data/TokenData';
import { TokenBalance } from '../../pages/PortfolioPage';
import { rgb } from '../../util/Colors';
import { SearchBar } from './SearchBar';

export type AssetBarItem = {
  token: TokenData;
  percentage: number;
  color?: string;
};

const Container = styled.div`
  position: relative;
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
  &:only-child {
    border-radius: 8px;
  }
  &.active {
    z-index: 1;
    transform: scale(1.03);
    box-shadow: 0px 0px 4px 0.25px ${(props) => props.color}, 0px 0px 4px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s ease-in-out, border-radius 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  }
`;

const AssetIcon = styled.img`
  width: 32px;
  height: 32px;
  border: 2px solid transparent;
  border-radius: 50%;
`;

export type AssetChunkProps = {
  token: TokenData;
  percentage: number;
  active: boolean;
  selected: boolean;
  color: string;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
};

export function AssetChunk(props: AssetChunkProps) {
  const { token, percentage, active, selected, onClick, onHover, onLeave, color } = props;
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
      <AssetIcon
        src={token.iconPath || ''}
        alt={token.ticker}
        className={selected ? 'selected' : ''}
        width={32}
        height={32}
      />
    </AssetChunkContainer>
  );
}

export type AssetBarProps = {
  balances: TokenBalance[];
  tokenColors: Map<string, string>;
  ignoreBalances: boolean;
  setActiveAsset: (asset: TokenData) => void;
};

export function AssetBar(props: AssetBarProps) {
  const { balances, tokenColors, ignoreBalances, setActiveAsset } = props;
  const [searchModeEnabled, setSearchModeEnabled] = useState(false);
  const [chunks, setChunks] = useState<AssetChunkProps[]>([]);
  const [defaultIndex, setDefaultIndex] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isHovering, setIsHovering] = useState<boolean>(false);

  const combinedTokenBalances = useMemo(() => {
    const combinedBalances: Map<string, TokenBalance> = new Map();
    balances.forEach((balance) => {
      const tokenAddress = getReferenceAddress(balance.token);
      const existingBalance = combinedBalances.get(tokenAddress);
      if (combinedBalances.has(tokenAddress)) {
        existingBalance!.balanceUSD += balance.balanceUSD;
      } else {
        combinedBalances.set(tokenAddress, balance);
      }
    });
    return Array.from(combinedBalances.values());
  }, [balances]);

  useEffect(() => {
    if (chunks.length > 0 && !isHovering && !searchModeEnabled) {
      setActiveIndex(defaultIndex);
      setActiveAsset(chunks[defaultIndex].token);
    }
  }, [chunks, chunks.length, defaultIndex, isHovering, searchModeEnabled, setActiveAsset]);

  useEffect(() => {
    const keyboardListener = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        event.stopPropagation();
        setSearchModeEnabled(true);
      }
    };
    window.addEventListener('keydown', keyboardListener);
    return () => {
      window.removeEventListener('keydown', keyboardListener);
    };
  });

  useEffect(() => {
    const totalBalanceUSD = combinedTokenBalances.reduce((acc, balance) => acc + balance.balanceUSD, 0);
    // filter out tokens with a balance < 10% of total balance and a balance greater than 0
    const filteredChunks = combinedTokenBalances.filter(
      (balance) => balance.balance !== 0 && balance.balanceUSD >= totalBalanceUSD * 0.1
    );
    const updatedTotalBalanceUSD = filteredChunks.reduce((acc, balance) => acc + balance.balanceUSD, 0);

    const newChunks = filteredChunks.map((chunk, index) => {
      const currentColor = tokenColors.get(chunk.token.address);
      const percentage = ignoreBalances ? 1 / filteredChunks.length : chunk.balanceUSD / updatedTotalBalanceUSD || 0;
      return {
        token: chunk.token,
        percentage: percentage,
        active: index === activeIndex,
        selected: index === defaultIndex,
        color: currentColor !== undefined ? rgb(currentColor) : 'transparent',
        onClick: () => {
          setDefaultIndex(index);
        },
        onHover: () => {
          setIsHovering(true);
          setActiveIndex(index);
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
  }, [combinedTokenBalances, tokenColors, activeIndex, defaultIndex, setActiveAsset, ignoreBalances]);

  return (
    <Container>
      {searchModeEnabled && (
        <SearchBar
          balances={combinedTokenBalances}
          tokenColors={tokenColors}
          chunks={chunks}
          defaultIndex={defaultIndex}
          setActiveIndex={setActiveIndex}
          setActiveAsset={setActiveAsset}
          setSearchModeEnabled={setSearchModeEnabled}
        />
      )}
      {!searchModeEnabled && chunks.map((chunk, index) => <AssetChunk key={index} {...chunk} />)}
    </Container>
  );
}
