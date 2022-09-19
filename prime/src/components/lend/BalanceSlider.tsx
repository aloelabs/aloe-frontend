import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import tw from 'twin.macro';
import { TokenData } from '../../data/TokenData';

const Wrapper = styled.div`
  width: 300px;
  overflow: hidden;
  position: relative;

  &:before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 40px;
    height: 100%;
    background: linear-gradient(to left, rgba(8, 14, 18, 0), rgba(8, 14, 18, 0.8));
    z-index: 100;
  }

  &:after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    width: 40px;
    height: 100%;
    background: linear-gradient(to right, rgba(8, 14, 18, 0), rgba(8, 14, 18, 0.8));
    z-index: 100;
  }
`;

const Slider = styled.div.attrs(
  (props: { duration: number, shouldAnimate: boolean }) => props
)`
  ${tw`flex`}
  width: max-content;
  animation-name: ${(props) => props.shouldAnimate ? 'slide' : 'none'};
  animation-duration: ${props => props.duration ?? 0}s;
  animation-iteration-count: infinite;
  animation-timing-function: linear;

  @keyframes slide {
    0% {
      transform: translateX(0%);
    }
    100% {
      transform: translateX(-50%);
    }
  }
`;

const SliderItem = styled.div`
  ${tw`flex flex-row justify-between items-center`}
  column-gap: 10px;
  white-space: nowrap;
  width: max-content;
  padding: 8px 16px;
`;

const TokenIcon = styled.img`
  ${tw`h-4 w-4`}
  max-width: unset;
  background-color: #fff;
  border-radius: 50%;
`;

export type TokenBalance = {
  token: TokenData;
  balance: string;
}

export type BalanceSliderProps = {
  tokenBalances: TokenBalance[];
}

export default function BalanceSlider(props: BalanceSliderProps) {
  const { tokenBalances } = props;
  const [shouldAnimate, setShouldAnimate] = useState<boolean>(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wasAnimating = shouldAnimate;
    if (wrapperRef.current && sliderRef.current) {
      const wrapperWidth = wrapperRef.current.offsetWidth;
      const sliderWidth = sliderRef.current.offsetWidth / (wasAnimating ? 2 : 1);
      if (wrapperWidth < sliderWidth && !wasAnimating) {
        setShouldAnimate(true);
      } else if (wrapperWidth >= sliderWidth && wasAnimating) {
        setShouldAnimate(false);
      }
    }
  }, [tokenBalances, shouldAnimate]);
  
  return (
    <Wrapper ref={wrapperRef}>
      <Slider ref={sliderRef} duration={tokenBalances.length * 2} shouldAnimate={shouldAnimate}>
        {tokenBalances.map((tokenBalance, index) => {
          return (
            <SliderItem key={index}>
              <TokenIcon src={tokenBalance.token.iconPath || ''} alt={tokenBalance.token.name} />
              {tokenBalance.token.name}
              {' - '}
              {tokenBalance.balance}
              {' '}
              {tokenBalance.token.ticker}
            </SliderItem>
          );
        })}
        {shouldAnimate && tokenBalances.map((tokenBalance, index) => {
          return (
            <SliderItem key={index}>
              <TokenIcon src={tokenBalance.token.iconPath || ''} alt={tokenBalance.token.name} />
              {tokenBalance.token.name}
              {' - '}
              {tokenBalance.balance}
              {' '}
              {tokenBalance.token.ticker}
            </SliderItem>
          );
        })}
      </Slider>
    </Wrapper>
  );
}
