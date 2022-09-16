import styled from 'styled-components';

export const SvgWrapper = styled.div.attrs(
  (props: {
    width?: number;
    height?: number;
    padding?: number;
    fillColor?: string;
    strokeColor?: string;
    hoverFillColor?: string;
    hoverStrokeColor?: string;
    activeFillColor?: string;
    activeStrokeColor?: string;
  }) => props
)`
  ${(props) => props.width && `width: ${props.width}px;`};
  ${(props) => props.height && `height: ${props.height}px;`};
  ${(props) => props.padding && `padding: ${props.padding}px;`};

  svg {
    path {
      ${(props) => props.fillColor && `fill: ${props.fillColor};`};
      ${(props) => props.strokeColor && `stroke: ${props.strokeColor};`};
    }
  }

  &:hover {
    svg {
      path {
        ${(props) => props.hoverFillColor && `fill: ${props.hoverFillColor};`};
        ${(props) => props.hoverStrokeColor && `stroke: ${props.hoverStrokeColor};`};
      }
    }
  }

  &:active {
    svg {
      path {
        ${(props) => props.activeFillColor && `fill: ${props.activeFillColor};`};
        ${(props) => props.activeStrokeColor && `stroke: ${props.activeStrokeColor};`};
      }
    }
  }
`;
