import styled from 'styled-components';
import tw from 'twin.macro';

export const LiquidityChartPlaceholder = styled.div`
  ${tw`flex flex-col items-start justify-evenly`}
  max-width: 350px;
  width: 100%;
  height: 227px;
  margin-top: 3px;
  margin-bottom: 20px;
  background: #0d171e;
  background-image: linear-gradient(to right, #0d171e 0%, #131f28 20%, #0d171e 40%, #0d171e 100%);
  background-repeat: no-repeat;
  background-size: 900px 300px;
  display: inline-block;
  animation: liquidityGraphShimmer 1s forwards linear infinite;
  overflow: hidden;
  position: relative;

  @keyframes liquidityGraphShimmer {
    0% {
      background-position: -900px 0;
    }
    100% {
      background-position: 900px 0;
    }
  }
`;
