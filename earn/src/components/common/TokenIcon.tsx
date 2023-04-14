import styled from 'styled-components';

import { Token } from '../../data/Token';

const StyledTokenIcon = styled.img.attrs((props: { width: number; height: number; borderRadius: string }) => props)`
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  background-color: #ffffff;
  box-shadow: 0 0 0 ${(props) => props.borderRadius} #000000;
  border-radius: 50%;
`;

export type TokenIconProps = {
  token: Token;
  width?: number;
  height?: number;
  borderRadius?: string;
};

export default function TokenIcon(props: TokenIconProps) {
  const { token, width, height, borderRadius } = props;
  return (
    <StyledTokenIcon
      src={token.iconPath}
      alt={token.name}
      width={width || 16}
      height={height || 16}
      borderRadius={borderRadius || '1px'}
    />
  );
}
