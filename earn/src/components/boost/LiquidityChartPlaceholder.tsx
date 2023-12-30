import styled from 'styled-components';

export const LiquidityChartPlaceholder = styled.div`
  width: 300px;
  height: 160px;
  background: #0d171e;
  background-image: linear-gradient(to right, #0d171e 0%, #131f28 20%, #0d171e 40%, #0d171e 100%);
  background-repeat: no-repeat;
  background-size: 100% 160px;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  display: inline-block;
  animation: liquidityChartShimmer 0.75s forwards linear infinite;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  margin-bottom: -15px;
  left: -16px;
  @keyframes liquidityChartShimmer {
    0% {
      background-position: -300px 0;
    }
    100% {
      background-position: 300px 0;
    }
  }
`;
