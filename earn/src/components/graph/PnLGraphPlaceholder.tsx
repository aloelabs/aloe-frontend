import styled from 'styled-components';
import tw from 'twin.macro';

export const PnLGraphPlaceholder = styled.div`
  ${tw`flex flex-col items-start justify-evenly`}
  width: 100%;
  height: 300px;
  background: #0d171e;
  background-image: linear-gradient(to right, #0d171e 0%, #131f28 20%, #0d171e 40%, #0d171e 100%);
  background-repeat: no-repeat;
  background-size: 100% 300px;
  border-radius: 8px;
  display: inline-block;
  animation: pnlGraphShimmer 0.75s forwards linear infinite;
  overflow: hidden;
  position: relative;
  //TODO: Improve responsiveness
  @keyframes pnlGraphShimmer {
    0% {
      background-position: -900px 0;
    }
    100% {
      background-position: 900px 0;
    }
  }
`;
