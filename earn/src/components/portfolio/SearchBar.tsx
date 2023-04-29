import { useMemo, useState } from 'react';

import { DropdownOption } from 'shared/lib/components/common/Dropdown';
import { Token } from 'shared/lib/data/Token';
import styled from 'styled-components';

import { ReactComponent as BackArrowIcon } from '../../assets/svg/back_arrow.svg';
import { TokenBalance } from '../../pages/PortfolioPage';
import { rgb } from '../../util/Colors';
import { AssetBarItem, AssetChunk } from './AssetBar';
import SearchInput from './TokenSearchInput';

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
`;

const BackButton = styled.button`
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  left: -12%;
  top: 50%;
  transform: translateY(-50%);
  svg {
    path {
      stroke: rgb(255, 255, 255);
    }
  }
`;

function getColorForToken(tokenAddress: string, tokenColors: Map<string, string>) {
  const tokenColor = tokenColors.get(tokenAddress);
  if (tokenColor !== undefined) {
    return rgb(tokenColor);
  }
  return 'transparent';
}

export type SearchBarProps = {
  balances: TokenBalance[];
  tokenColors: Map<string, string>;
  chunks: AssetBarItem[];
  defaultIndex: number;
  setActiveIndex: (index: number) => void;
  setActiveAsset: (asset: Token) => void;
  setSearchModeEnabled: (enabled: boolean) => void;
};

export function SearchBar(props: SearchBarProps) {
  const { balances, tokenColors, chunks, defaultIndex, setActiveIndex, setActiveAsset, setSearchModeEnabled } = props;
  const [activeSearchAsset, setActiveSearchAsset] = useState<Token | null>(null);

  const searchInputOptions: DropdownOption<Token>[] = useMemo(() => {
    // Note: Filtering out any tokens that have a balance of 0
    return balances
      .filter((balance) => balance.balance > 0)
      .map((balance) => {
        return {
          label: balance.token.ticker || '',
          value: balance.token,
        };
      });
  }, [balances]);

  return (
    <Container>
      <BackButton
        onClick={() => {
          setActiveIndex(defaultIndex);
          setActiveAsset(chunks[defaultIndex].token);
          setActiveSearchAsset(null);
          setSearchModeEnabled(false);
        }}
      >
        <BackArrowIcon />
        Back
      </BackButton>
      {activeSearchAsset ? (
        <Container>
          <AssetChunk
            token={activeSearchAsset}
            percentage={1}
            active={true}
            selected={true}
            color={getColorForToken(activeSearchAsset.address, tokenColors)}
            onClick={() => {}}
            onHover={() => {}}
            onLeave={() => {}}
          />
        </Container>
      ) : (
        <SearchInput
          autoFocus={true}
          options={searchInputOptions}
          onOptionSelected={(option) => {
            setActiveSearchAsset(option.value);
            setActiveAsset(option.value);
          }}
        />
      )}
    </Container>
  );
}
