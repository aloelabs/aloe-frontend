import styled from 'styled-components';

const StyledTokenIcon = styled.img.attrs((props: { width: number; height: number; borderRadius: string }) => props)`
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  background-color: #ffffff;
  box-shadow: 0 0 0 ${(props) => props.borderRadius} #000000;
  border-radius: 50%;
  max-width: none;
`;

export type TokenIconProps = {
  token: { name: string; logoURI: string };
  width?: number;
  height?: number;
  borderRadius?: string;
  link?: string;
};

export default function TokenIcon(props: TokenIconProps) {
  const { token, width, height, borderRadius, link } = props;

  const icon = (
    <StyledTokenIcon
      src={token.logoURI}
      alt={token.name}
      width={width || 16}
      height={height || 16}
      borderRadius={borderRadius || '1px'}
    />
  );

  return link ? (
    <a href={link} target='_blank' rel='noreferrer'>
      {icon}
    </a>
  ) : (
    icon
  );
}
