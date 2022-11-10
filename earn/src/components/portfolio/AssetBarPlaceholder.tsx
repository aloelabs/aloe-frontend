import styled from 'styled-components';

export const AssetBarPlaceholder = styled.div`
  width: 100%;
  height: 64px;
  border-radius: 8px;
  background-color: #0d171e;
  background-image: linear-gradient(to right, #0d171e 0%, #131f28 20%, #0d171e 40%, #0d171e 100%);
  background-repeat: no-repeat;
  background-size: 200% 100%;
  display: inline-block;
  animation: assetBarShimmer 0.75s forwards linear infinite;
  overflow: hidden;
  position: relative;

  @keyframes assetBarShimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }
`;
