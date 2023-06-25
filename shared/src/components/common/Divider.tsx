import styled from 'styled-components';
import { GREY_700 } from '../../data/constants/Colors';

const DEFAULT_COLOR = GREY_700;

export const Divider = styled.div.attrs((props: { height?: string; color?: string }) => props)`
  width: 100%;
  height: ${(props) => props.height || '1px'};
  background-color: ${(props) => props.color || DEFAULT_COLOR};
`;
