import { RESPONSIVE_BREAKPOINT_MD } from 'shared/lib/data/constants/Breakpoints';
import styled from 'styled-components';

export const BorrowGraphPlaceholder = styled.div<{ $animate: boolean }>`
  height: 374px;
  width: 520px;
  margin-left: auto;

  border-radius: 8px;
  background-color: #0d171e;
  display: inline-block;
  animation: ${(props) => (props.$animate ? 'borrowGraphShimmer 0.75s forwards linear infinite' : '')};
  background-image: ${(props) =>
    props.$animate ? 'linear-gradient(to right, #0d171e 0%, #131f28 20%, #0d171e 40%, #0d171e 100%)' : ''};
  background-repeat: no-repeat;
  background-size: 200% 100%;
  overflow: hidden;
  position: relative;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    margin-left: 0;
    margin-right: auto;
    /* 99% is important here as the graph does not render properly at 100% width */
    width: 99%;
  }

  @keyframes borrowGraphShimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }
`;
