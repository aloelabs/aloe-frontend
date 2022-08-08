import React, { useEffect, useState } from 'react';
// import './App.css';
import styled from 'styled-components';

// import Button from 'react-bootstrap/Button';
// import Dropdown from 'react-bootstrap/Dropdown';

import { WbtcLogoNew, WethLogo, UsdcLogo } from '../../assets/svg/tokens';
import { ReactComponent as X } from '../../assets/svg/x.svg';
import { classNames } from '../../util/ClassNames';
import { getProminentColor, rgb } from '../../util/Colors';
import { FilledGreyButton, FilledGreyButtonWithIcon } from '../common/Buttons';
import {
  Dropdown,
  DropdownButtonAction,
  DropdownOption,
} from '../common/Dropdown';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: end;
  align-items: end;
  width: 100%;
`;

const MenuWrapper = styled.div`
  display: flex;
  /* grid-template-columns: 2fr 0.25fr 0.75fr; */
  align-items: center;
  justify-content: space-between;
  height: 60px;
  width: 400px;
`;

const TokenDetails = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-left: 10px;
  height: 100%;
  width: 100%;
  user-select: none;
  color: white;
  opacity: 0.6;
`;

const SquareWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  width: 400px;
`;

const Square = styled.div<{
  color: string;
  icon: string;
  isSelected: boolean;
  hide: boolean;
  accent?: string;
  hideAccent: boolean;
}>`
  position: relative;
  height: 40px;
  width: 40px;
  user-select: none;
  background-color: transparent;
  opacity: ${({ hide }) => (hide ? 0.3 : 1.0)};
  :before {
    content: '';
    position: absolute;
    top: 10px;
    left: 10px;
    height: 20px;
    width: 20px;
    border-radius: 4px;
    background-color: ${({ color }) => color};
    transition: opacity 0.2s ease;
    transform: scale(${({ isSelected }) => (isSelected ? 1.5 : 1.0)});
    box-shadow: ${({ isSelected }) =>
      isSelected ? '0 0 0 1px white' : 'none'};
  }
  :hover:before {
    background-image: url(${({ icon }) => icon});
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    transform: scale(1.5);
  }
  :after {
    content: '';
    visibility: ${({ hideAccent, accent }) =>
      hideAccent || accent === undefined ? 'hidden' : 'visible'};
    position: absolute;
    top: 9px;
    right: 8px;
    width: 8px;
    height: 8px;
    border-radius: 100%;
    background-color: ${({ accent }) => accent ?? 'transparent'};
    box-shadow: 0 0 0 1px white;
  }
  :hover:after {
    transform: translate(5px, -5px);
  }
`;

enum TokenCategory {
  WBTC,
  WETH,
  USDC,
}

const icons: {
  path: string;
  category: TokenCategory;
  name: string;
  accentPath?: string;
}[] = [];

for (let i = 0; i < 100; i++) {
  if (i < 32)
    icons.push({
      path: WbtcLogoNew,
      category: TokenCategory.WBTC,
      name: 'Wrapped Bitcoin',
    });
  else if (i < 44)
    icons.push({
      path: WbtcLogoNew,
      category: TokenCategory.WBTC,
      name: 'WBTC+ ☯️WETH (2% APY)',
      accentPath: WethLogo,
    });
  else if (i < 45)
    icons.push({
      path: WbtcLogoNew,
      category: TokenCategory.WBTC,
      name: 'WBTC+ ☯️USDC (3% APY)',
      accentPath: UsdcLogo,
    });
  else if (i < 57)
    icons.push({
      path: WethLogo,
      category: TokenCategory.WETH,
      name: 'Wrapped Ether',
    });
  else if (i < 71)
    icons.push({
      path: WethLogo,
      category: TokenCategory.WETH,
      name: 'WETH+ ☯️USDC (1% APY)',
      accentPath: UsdcLogo,
    });
  else if (i < 75)
    icons.push({
      path: WethLogo,
      category: TokenCategory.WETH,
      name: 'WETH+ ☯️WBTC (6% APY)',
      accentPath: WbtcLogoNew,
    });
  else
    icons.push({
      path: UsdcLogo,
      category: TokenCategory.USDC,
      name: 'USD Coin',
    });
}

const conversionOptions = new Map<TokenCategory, string[]>();
conversionOptions.set(TokenCategory.WBTC, [
  'Wrapped Bitcoin',
  'WBTC+ ☯️WETH (2% APY)',
  'WBTC+ ☯️USDC (3% APY)',
]);
conversionOptions.set(TokenCategory.WETH, [
  'Wrapped Ether',
  'WETH+ ☯️USDC (1% APY)',
  'WETH+ ☯️WBTC (6% APY)',
]);
conversionOptions.set(TokenCategory.USDC, [
  'USD Coin',
  'USDC+ ☯️WETH (9% APY)',
]);

type SquareProps = {
  color: string;
  icon: string;
  isSelected: boolean;
  category: TokenCategory;
  name: string;
  accent?: string;
};

type MouseHoldState = {
  wasHeld: boolean;
  initialIcon?: string;
  initialIdx?: number;
};

export default function LendPortfolioWidget() {
  const [squares, setSquares] = useState<SquareProps[]>([]);

  const [activeCategory, setActiveCategory] = useState<TokenCategory | null>(
    null
  );

  const [activeSquare, setActiveSquare] = useState<SquareProps | null>(null);

  const [mouseHoldState, setMouseHoldState] = useState<MouseHoldState>({
    wasHeld: false,
  });

  useEffect(() => {
    const createSquares = async () => {
      const iconsSet = new Set(icons);
      const colorMap = new Map<string, string>();

      await Promise.all(
        Array.from(iconsSet.values()).map(async (icon) => {
          const color = await getProminentColor(icon.path);
          colorMap.set(icon.path, rgb(color));
        })
      );

      const newSquares = icons.map((icon) => {
        return {
          icon: icon.path,
          color: colorMap.get(icon.path)!,
          isSelected: false,
          category: icon.category,
          name: icon.name,
          accent:
            icon.accentPath !== undefined
              ? colorMap.get(icon.accentPath)
              : undefined,
        };
      });
      // newSquares.sort((a, b) => a.name.localeCompare(b.name));
      setSquares(newSquares);
    };

    createSquares();
  }, []);

  /*
  
  - Categories other than the one I'm hovering over should be dimmed.
  - On mouse-down, clear previous selection. Select current box.
  - If mouse remains down and enters other boxes within active *token*, select all boxes in [mouse down box, current box]
  */

  const somethingIsSelected = squares.find((square) => square.isSelected);

  return (
    <Container>
      <MenuWrapper>
        <TokenDetails>{activeSquare?.name ?? ''}</TokenDetails>
        <div className={classNames(somethingIsSelected ? 'flex' : 'hidden', 'gap-2')}>
          <FilledGreyButtonWithIcon
            hidden={!somethingIsSelected}
            onClick={() => {
              // deselect all squares
              const newSquares = squares.map((square) => {
                return { ...square, isSelected: false };
              });
              setSquares(newSquares);
            }}
            Icon={<X />}
            size='M'
            position='center'
            svgColorType='stroke'
          />
          <DropdownButtonAction
            label='Convert to'
            options={[
              { label: 'Wrapped Bitcoin', value: 'wbtc' },
              { label: 'Wrapped Ether', value: 'weth' },
              { label: 'USD Coin', value: 'usdc' },
            ]}
            onSelect={(option: DropdownOption) => {}}
            placeAbove={true}
          />
        </div>
        
        {/* <Dropdown align="end" drop="up" hidden={!somethingIsSelected}>
          <Dropdown.Toggle variant="dark" id="dropdown-basic">
            Convert to
          </Dropdown.Toggle>

          <Dropdown.Menu variant="dark">
            {
              activeCategory !== null
              ? conversionOptions.get(activeCategory)!.map((name) => {
                return <Dropdown.Item href="#/action-1">{name}</Dropdown.Item>
              })
              : ' '
            } */}
        {/* <Dropdown.Item href="#/action-1">Action</Dropdown.Item>
            <Dropdown.Item href="#/action-2">Another action</Dropdown.Item>
            <Dropdown.Item href="#/action-3">Something else</Dropdown.Item> */}
        {/* </Dropdown.Menu>
        </Dropdown> */}
      </MenuWrapper>
      <SquareWrapper
        onMouseLeave={() => {
          setActiveSquare(null);
          if (!somethingIsSelected) setActiveCategory(null);
        }}
      >
        {squares.map((square, idx) => (
          <Square
            key={idx}
            color={square.color}
            icon={square.icon}
            isSelected={square.isSelected}
            hide={activeCategory !== null && activeCategory !== square.category}
            accent={square.accent}
            hideAccent={activeCategory !== square.category}
            onMouseDown={() => {
              console.log('Mouse Down', idx);
              setMouseHoldState({
                wasHeld: true,
                initialIcon: square.icon,
                initialIdx: idx,
              });
              setActiveCategory(square.category);

              // deselect all squares except the one that was just clicked
              const newSquares = squares.map((square, j) => {
                return { ...square, isSelected: j === idx };
              });
              setSquares(newSquares);
            }}
            onMouseUp={() => {
              console.log('Mouse Up', idx);
              setMouseHoldState({
                wasHeld: false,
                initialIcon: undefined,
                initialIdx: undefined,
              });
            }}
            onMouseEnter={(ev) => {
              console.log('Mouse Enter', idx);
              setActiveSquare(square);
              if (!squares.find((square) => square.isSelected))
                setActiveCategory(square.category);

              let mouseHoldStateNew = { ...mouseHoldState };
              const mouseIsHeld = ev.buttons !== 0;

              // cover the case where we don't click a square, but rather drag in
              // from outside this component's bbox
              if (mouseIsHeld && !mouseHoldState.wasHeld) {
                mouseHoldStateNew = {
                  wasHeld: true,
                  initialIcon: square.icon,
                  initialIdx: idx,
                };
                setMouseHoldState(mouseHoldStateNew);
              }

              if (mouseIsHeld) {
                const a = Math.min(mouseHoldStateNew.initialIdx!, idx);
                const b = Math.max(mouseHoldStateNew.initialIdx!, idx);

                const newSquares = squares.map((square, j) => {
                  return {
                    ...square,
                    isSelected:
                      a <= j &&
                      j <= b &&
                      mouseHoldStateNew.initialIcon === square.icon,
                  };
                });
                setSquares(newSquares);
              }
            }}
          ></Square>
        ))}
      </SquareWrapper>
    </Container>
  );
}
