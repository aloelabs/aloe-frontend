import styled from 'styled-components';

const DEFAULT_COLOR = 'rgba(26,41,52,1)';

export const Divider = styled.div.attrs(
  (props: { height?: string; color?: string }) => props
)`
  width: 100%;
  height: ${(props) => props.height || '1px'};
  background-color: ${(props) => props.color || DEFAULT_COLOR};
`;
