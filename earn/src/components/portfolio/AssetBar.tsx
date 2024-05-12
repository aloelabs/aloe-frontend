import React, { useEffect, useMemo, useState } from 'react';

import { RESPONSIVE_BREAKPOINT_SM } from 'shared/lib/data/constants/Breakpoints';
import useHover from 'shared/lib/data/hooks/UseHover';
import { Token } from 'shared/lib/data/Token';
import styled from 'styled-components';

import { SearchBar } from './SearchBar';
import { ReactComponent as MoreIcon } from '../../assets/svg/more_ellipsis.svg';
import { TokenBalance } from '../../pages/PortfolioPage';
import { rgb } from '../../util/Colors';

export type AssetBarItem = {
  token: Token;
  percentage: number;
  color?: string;
};

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 56px;
  display: flex;
`;

const AssetChunkContainer = styled.div.attrs((props: { percentage: number; color: string }) => props)`
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: ${(props) => props.percentage * 100}%;
  height: 56px;
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
    transform: scaleY(1.03);

    box-shadow: 0px 0px 4px 0.25px ${(props) => props.color}, 0px 0px 4px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s ease-in-out, border-radius 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  }
`;

const AssetIcon = styled.img<{ $outlineColor: string }>`
  width: 32px;
  height: 32px;
  outline: 1px solid ${(props) => props.$outlineColor};
  outline-offset: -0.5px;
  border-radius: 50%;
  background-color: #ffffff;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    width: 24px;
    height: 24px;
  }
`;

const StyledMoreIcon = styled(MoreIcon)`
  transform: rotate(90deg);
`;

const MAX_NUM_CHUNKS = 7;

export type AssetChunkProps = {
  token: Token;
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
        src={token.logoURI || ''}
        alt={token.symbol}
        className={selected ? 'selected' : ''}
        $outlineColor={color}
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
  setActiveAsset: (asset: Token) => void;
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
      const tokenAddress = balance.token.underlying.address;
      if (combinedBalances.has(tokenAddress)) {
        const existingBalance = combinedBalances.get(tokenAddress)!;
        existingBalance.balance += balance.balance;
        existingBalance.balanceUSD += balance.balanceUSD;
      } else {
        combinedBalances.set(tokenAddress, { ...balance });
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
      } else if (event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setSearchModeEnabled(false);
      }
    };
    window.addEventListener('keydown', keyboardListener);
    return () => {
      window.removeEventListener('keydown', keyboardListener);
    };
  });

  useEffect(() => {
    const filteredChunks = combinedTokenBalances.filter((balance) => balance.balance > 0);
    filteredChunks.sort((a, b) => b.balanceUSD - a.balanceUSD);

    const hasHiddenTokens = filteredChunks.length > MAX_NUM_CHUNKS;
    const updatedTotalBalanceUSD = filteredChunks.reduce(
      (acc, balance, i) => (i < MAX_NUM_CHUNKS ? acc + balance.balanceUSD : 0),
      0
    );

    const numChunks = Math.min(MAX_NUM_CHUNKS, filteredChunks.length);
    const minSize = 1.0 / numChunks;
    const maxSize = 3 * minSize;

    const newChunks: AssetChunkProps[] = [];
    for (let i = 0; i < numChunks; i += 1) {
      const chunk = filteredChunks[i];

      const currentColor = tokenColors.get(chunk.token.address);
      let percentage: number = ignoreBalances
        ? ((maxSize - minSize) / numChunks) * (numChunks - i) + minSize
        : chunk.balanceUSD / updatedTotalBalanceUSD || 0;
      if (hasHiddenTokens) {
        percentage = percentage - 0.05 / filteredChunks.length;
      }
      newChunks.push({
        token: chunk.token,
        percentage: percentage,
        active: i === activeIndex,
        selected: i === defaultIndex,
        color: currentColor !== undefined ? rgb(currentColor) : 'transparent',
        onClick: () => {
          setDefaultIndex(i);
        },
        onHover: () => {
          setIsHovering(true);
          setActiveIndex(i);
          setActiveAsset(chunk.token);
        },
        onLeave: () => {
          setActiveIndex(defaultIndex);
          setActiveAsset(filteredChunks[defaultIndex].token);
          setIsHovering(false);
        },
      });
    }
    setChunks(newChunks);
  }, [combinedTokenBalances, tokenColors, activeIndex, defaultIndex, setActiveAsset, ignoreBalances]);

  const hasHiddenTokens = combinedTokenBalances.length !== chunks.length;

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
      {!searchModeEnabled && hasHiddenTokens && (
        <AssetChunkContainer
          percentage={0.05}
          color='rgba(26,41,52,1)'
          onClick={() => {
            setSearchModeEnabled(true);
          }}
        >
          <StyledMoreIcon width={32} height={32} />
        </AssetChunkContainer>
      )}
    </Container>
  );
}
