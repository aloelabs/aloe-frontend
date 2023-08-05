import styled from 'styled-components';

export const BoostCardPlaceholder = styled.div`
  width: 300px;
  height: 423.9px;
  background: #0d171e;
  background-image: linear-gradient(to right, #0d171e 0%, #131f28 20%, #0d171e 40%, #0d171e 100%);
  background-repeat: no-repeat;
  background-size: 100% 423.9px;
  border-radius: 8px;
  display: inline-block;
  animation: boostCardShimmer 0.75s forwards linear infinite;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  @keyframes boostCardShimmer {
    0% {
      background-position: -300px 0;
    }
    100% {
      background-position: 300px 0;
    }
  }
`;
