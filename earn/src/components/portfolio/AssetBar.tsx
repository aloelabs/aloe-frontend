import React, { useEffect, useMemo } from 'react';

import { DropdownOption } from 'shared/lib/components/common/Dropdown';
import { SquareInputWithIcon } from 'shared/lib/components/common/Input';
import { Text } from 'shared/lib/components/common/Typography';
import useHover from 'shared/lib/data/hooks/UseHover';
import styled from 'styled-components';

import { ReactComponent as BackArrowIcon } from '../../assets/svg/back_arrow.svg';
import useEffectOnce from '../../data/hooks/UseEffectOnce';
import { LendingPairBalances } from '../../data/LendingPair';
import { getReferenceAddress, GetTokenData, TokenData } from '../../data/TokenData';
import { TokenBalance } from '../../pages/PortfolioPage';
import { rgb } from '../../util/Colors';
import IndependentTooltip from './LeftFacingIndendentTooltip';
import SearchInput from './SearchInput';

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
    transform: scale(1.04);
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

const BackButton = styled.button`
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  left: -10%;
  top: 50%;
  transform: translateY(-50%);

  svg {
    path {
      stroke: rgb(255, 255, 255);
    }
  }
`;

type AssetChunkProps = {
  token: TokenData;
  percentage: number;
  active: boolean;
  selected: boolean;
  color: string;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
};

function AssetChunk(props: AssetChunkProps) {
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

type SearchBarProps = {
  combinedBalances: TokenBalance[];
  setActiveSearchAsset: (token: TokenData) => void;
  setActiveAsset: (token: TokenData) => void;
};

function SearchBar(props: SearchBarProps) {
  const { combinedBalances, setActiveSearchAsset, setActiveAsset } = props;
  const options: DropdownOption[] = useMemo(() => {
    return combinedBalances
      .filter((balance) => {
        return balance.balance > 0;
      })
      .map((balance) => {
        return {
          label: balance.token.ticker || '',
          value: balance.token.address as string,
        };
      });
  }, [combinedBalances]);
  return (
    <SearchInput
      options={options}
      onOptionSelected={(option) => {
        setActiveSearchAsset(GetTokenData(option.value));
        setActiveAsset(GetTokenData(option.value));
      }}
    />
  );
}

function getColor(color: string, tokenColors: Map<string, string>) {
  const tokenColor = tokenColors.get(color);
  if (tokenColor !== undefined) {
    return rgb(tokenColor);
  }
  return 'transparent';
}

export type AssetBarProps = {
  combinedBalances: TokenBalance[];
  tokenColors: Map<string, string>;
  setActiveAsset: (token: TokenData) => void;
};

export default function AssetBar(props: AssetBarProps) {
  const { combinedBalances, tokenColors, setActiveAsset } = props;
  const [searchModeEnabled, setSearchModeEnabled] = React.useState(false);
  const [activeSearchAsset, setActiveSearchAsset] = React.useState<TokenData | null>(null);
  const [chunks, setChunks] = React.useState<AssetChunkProps[]>([]);
  const [defaultIndex, setDefaultIndex] = React.useState<number>(0);
  const [activeIndex, setActiveIndex] = React.useState<number>(0);
  const [isHovering, setIsHovering] = React.useState<boolean>(false);

  const combinedTokenBalances = useMemo(() => {
    const balances: Map<string, TokenBalance> = new Map();
    combinedBalances.forEach((balance) => {
      const tokenAddress = getReferenceAddress(balance.token);
      const existingBalance = balances.get(tokenAddress);
      if (balances.has(tokenAddress)) {
        existingBalance!.balanceUSD += balance.balanceUSD;
      } else {
        balances.set(tokenAddress, balance);
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
        selected: idx === defaultIndex,
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
      {searchModeEnabled ? (
        <div>
          <BackButton
            onClick={() => {
              setActiveIndex(defaultIndex);
              setActiveAsset(chunks[defaultIndex].token);
              setActiveSearchAsset(null);
              setSearchModeEnabled(false);
            }}
          >
            <BackArrowIcon width={16} height={16} />
            Back
          </BackButton>
          {activeSearchAsset ? (
            <Container>
              <AssetChunk
                token={activeSearchAsset}
                percentage={1}
                active={true}
                selected={true}
                color={getColor(activeSearchAsset.address, tokenColors)}
                onClick={() => {}}
                onHover={() => {}}
                onLeave={() => {}}
              />
            </Container>
          ) : (
            <SearchBar
              combinedBalances={combinedTokenBalances}
              setActiveSearchAsset={setActiveSearchAsset}
              setActiveAsset={setActiveAsset}
            />
          )}
        </div>
      ) : (
        chunks.map((chunk, index) => <AssetChunk key={index} {...chunk} />)
      )}
    </Container>
  );
}
