import styled from 'styled-components';
import tw from 'twin.macro';
import { RESPONSIVE_BREAKPOINT_MD, RESPONSIVE_BREAKPOINT_SM } from '../../data/constants/Breakpoints';

const CARD_BODY_BG_COLOR = 'rgba(13, 23, 30, 1)';
const TOKEN_ICON_BORDER_COLOR = 'rgba(0, 0, 0, 1)';
const BODY_DIVIDER_BG_COLOR = 'rgba(255, 255, 255, 0.1)';

export const CardWrapper = styled.div.attrs((props: { borderGradient: string; shadowColor: string }) => props)`
  display: grid;
  grid-template-columns: 89fr 159fr;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  position: relative;

  &:hover {
    box-shadow: 0px 8px 48px 0px ${(props) => props.shadowColor};
    &:before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: 8px;
      padding: 1.5px;
      background: ${(props) => props.borderGradient};
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }
  }

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    grid-template-columns: 1fr;
  }
`;

export const CardTitleWrapper = styled.div.attrs((props: { backgroundGradient: string }) => props)`
  ${tw`flex flex-col items-start justify-center`}
  padding: 32px;
  gap: 18px;
  background: ${(props) => props.backgroundGradient};
  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    padding: 32px 16px;
  }
`;

export const CardSubTitleWrapper = styled.div`
  ${tw`flex flex-row items-center`}
  gap: 16px;
  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    flex-direction: column;
    align-items: start;
  }
`;

export const CardBodyWrapper = styled.div`
  display: flex;
  align-items: center;
  background: ${CARD_BODY_BG_COLOR};
  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

export const TokenPairTickers = styled.div`
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
  font-family: 'ClashDisplay-Variable';
`;

export const TokenIconsWrapper = styled.div`
  ${tw`flex flex-row items-center justify-start -space-x-2`}
  width: 56px;
  height: 32px;
`;

export const TokenIcon = styled.img`
  ${tw`rounded-full bg-white`}
  position: relative;
  width: 32px;
  height: 32px;
  box-shadow: 0 0 0 3px ${TOKEN_ICON_BORDER_COLOR};
`;

export const BodySubContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: calc(50% - 0.5px);
  padding-left: 40px;
  padding-right: 48px;
  height: 88px;
  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    padding: 20px 32px;
    height: auto;
  }
  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    width: 100%;
  }
`;

export const BodyDivider = styled.div`
  width: 1px;
  height: 88px;
  background-color: ${BODY_DIVIDER_BG_COLOR};
  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    width: 100%;
    height: 1px;
  }
`;

export const ValueText = styled.span`
  font-size: 32px;
  font-weight: 700;
`;
