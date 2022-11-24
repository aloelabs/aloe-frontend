import React from 'react';

import styled from 'styled-components';
import tw from 'twin.macro';

import UnknownTokenIcon from '../../assets/svg/tokens/unknown_token.svg';
import { Token } from '../../data/Token';

const DEFAULT_TOKEN_BACKGROUND_COLOR = 'rgba(255, 255, 255, 1)';
const OMIT_TOKEN_BACKGROUND_COLOR = 'transparent';
const DEFAULT_TOKEN_BORDER_COLOR = 'rgba(0, 0, 0, 1)';

function calculatePerTokenOffset(numTokens: number) {
  return (8 + (numTokens - 2)) * -1.0;
}

const TokenIconsWrapper = styled.div.attrs((props: { numTokens: number; perTokenOffset: number }) => props)`
  ${tw`flex flex-row items-center justify-start`}
  --num-tokens: ${(props) => props.numTokens};
  --per-token-offset: ${(props) => props.perTokenOffset};
  width: calc(calc(var(--per-token-offset) * -1px) + var(--num-tokens) * var(--per-token-offset));
  height: 32px;
`;

const TokenIcon = styled.img.attrs((props: { backgroundColor: string; borderColor: string; offset: number }) => props)`
  ${tw`w-8 h-8 rounded-full bg-white`}
  background-color: ${(props) => props.backgroundColor};
  box-shadow: 0 0 0 3px ${(props) => props.borderColor};

  &:not(:first-child) {
    margin-left: ${(props) => props.offset}px;
  }
`;

export type YieldTokenIconsProps = {
  tokens: Array<Token | undefined>;
  iconBorderColor?: string;
  omitBackground?: boolean;
};

export default function YieldTokenIcons(props: YieldTokenIconsProps) {
  const { tokens, iconBorderColor, omitBackground } = props;
  const perTokenOffset = calculatePerTokenOffset(tokens.length);
  return (
    <TokenIconsWrapper numTokens={tokens.length} perTokenOffset={perTokenOffset}>
      {tokens.map((token, index) => {
        if (!token) {
          return <TokenIcon key={index} src={UnknownTokenIcon} />;
        }
        return (
          <TokenIcon
            key={index}
            src={token.iconPath}
            backgroundColor={omitBackground ? OMIT_TOKEN_BACKGROUND_COLOR : DEFAULT_TOKEN_BACKGROUND_COLOR}
            borderColor={iconBorderColor || DEFAULT_TOKEN_BORDER_COLOR}
            alt={token.name}
            offset={perTokenOffset}
          />
        );
      })}
    </TokenIconsWrapper>
  );
}
