import styled from 'styled-components';
import TokenIcon from './TokenIcon';

const Container = styled.div`
  display: flex;
  align-items: center;
  margin-left: 0.5rem;
  transition: margin 0.3s ease-in-out;

  div {
    margin-left: -0.5rem;
    transition: margin 0.3s ease-in-out;
  }

  &:hover {
    margin-left: 0;
    div {
      margin-left: 0;
    }
  }
`;

export type TokenIconsProps = {
  tokens: { name: string; symbol: string; logoURI: string }[];
  width?: number;
  height?: number;
  links?: string[];
};

export default function TokenIcons(props: TokenIconsProps) {
  const { tokens, width, height, links } = props;

  return (
    <Container>
      {tokens.map((token, index) => (
        <div key={index}>
          <TokenIcon key={index} token={token} width={width || 16} height={height || 16} link={links?.at(index)} />
        </div>
      ))}
    </Container>
  );
}
