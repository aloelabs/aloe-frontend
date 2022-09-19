import styled from 'styled-components';
import tw from 'twin.macro';
import { RESPONSIVE_BREAKPOINT_SM, RESPONSIVE_BREAKPOINT_XS } from '../../../data/constants/Breakpoints'
export const LiquidityChartPlaceholder = styled.div`
  ${tw`flex flex-col items-start justify-evenly`}
  width: 350px;
  height: 227px;
  margin-top: 3px;
  margin-bottom: 20px;
  background: #0d171e;
  background-image: linear-gradient(
    to right,
    #0d171e 0%,
    #131f28 20%,
    #0d171e 40%,
    #0d171e 100%
  );
  background-repeat: no-repeat;
  background-size: 900px 300px;
  display: inline-block;
  animation: blendGraphShimmer 1s forwards linear infinite;
  overflow: hidden;
  position: relative;
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;

  @keyframes blendGraphShimmer {
    0% {
      background-position: -900px 0;
    }
    100% {
      background-position: 900px 0;
    }
  }
`;
