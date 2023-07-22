import styled from 'styled-components';
import { Token } from '../../data/Token';
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
  tokens: Token[];
};

export default function TokenIcons(props: TokenIconsProps) {
  const { tokens } = props;
  return (
    <Container>
      {tokens.map((token, index) => (
        <div key={index}>
          <TokenIcon key={index} token={token} width={16} height={16} />
        </div>
      ))}
    </Container>
  );
}
