import React, { useState } from 'react';

import {
  BodyDivider,
  BodySubContainer,
  CardBodyWrapper,
  CardSubTitleWrapper,
  CardTitleWrapper,
  CardWrapper,
} from 'shared/lib/components/common/Card';
import FeeTierContainer from 'shared/lib/components/common/FeeTierContainer';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import tw from 'twin.macro';
import { useAccount } from 'wagmi';

import { ReactComponent as EditIcon } from '../../assets/svg/edit.svg';
import { ReactComponent as MoreIcon } from '../../assets/svg/more_ellipsis.svg';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';
import useProminentColor from '../../data/hooks/UseProminentColor';
import { LendingPair } from '../../data/LendingPair';
import { getBrighterColor, rgb, rgba } from '../../util/Colors';
import TokenPairIcons from '../common/TokenPairIcons';
import LendTokenInfo from './LendTokenInfo';
import ContractLinksModal from './modal/ContractLinksModal';
import EditPositionModal from './modal/EditPositionModal';

const TOKEN_APY_BG_COLOR = 'rgb(29, 41, 53)';

const TokenAPYWrapper = styled.div`
  padding: 2px 8px;
  border-radius: 8px;
  background-color: ${TOKEN_APY_BG_COLOR};
`;

const CustomBodySubContainer = styled(BodySubContainer)`
  position: relative;
  padding-right: 40px;
`;

const CardActionButton = styled.button`
  ${tw`flex items-center justify-center absolute`}
  border-radius: 50%;
  background-color: white;
  right: 20px;

  svg {
    padding: 8px;
    path {
      stroke: rgba(51, 60, 66, 255);
    }
  }

  &:disabled {
    opacity: 0.5;
  }
`;

function EditPositionButton(props: { Icon: React.ReactChild; onClick?: () => void; disabled?: boolean }) {
  return (
    <CardActionButton onClick={props?.onClick} disabled={props.disabled}>
      {props.Icon}
    </CardActionButton>
  );
}

export type LendPairCardProps = {
  pair: LendingPair;
  hasDeposited0: boolean;
  hasDeposited1: boolean;
};

export default function LendPairCard(props: LendPairCardProps) {
  const { hasDeposited0, hasDeposited1 } = props;
  const { token0, token1, kitty0, kitty1, kitty0Info, kitty1Info, uniswapFeeTier } = props.pair;
  const [isEditToken0PositionModalOpen, setIsEditToken0PositionModalOpen] = useState<boolean>(false);
  const [isEditToken1PositionModalOpen, setIsEditToken1PositionModalOpen] = useState<boolean>(false);
  const [isContractLinksModalOpen, setIsContractLinksModalOpen] = useState<boolean>(false);
  const [isCardHovered, setIsCardHovered] = useState<boolean>(false);
  const token0Color = useProminentColor(token0.logoURI);
  const token1Color = useProminentColor(token1.logoURI);
  const { address: accountAddress } = useAccount();
  // Create the variables for the gradients.
  const cardTitleBackgroundGradient = `linear-gradient(90deg, ${rgba(token0Color, 0.25)} 0%, ${rgba(
    token1Color,
    0.25
  )} 100%)`;
  const cardBorderGradient = `linear-gradient(90deg, ${rgb(token0Color)} 0%, ${rgb(token1Color)} 100%)`;
  const cardShadowColor = rgba(getBrighterColor(token0Color, token1Color), 0.16);

  return (
    <div>
      <CardWrapper
        borderGradient={cardBorderGradient}
        shadowColor={cardShadowColor}
        onMouseOver={() => {
          // TODO: figure out a more performant way to do this (if possible)
          if (!isCardHovered) {
            setIsCardHovered(true);
          }
        }}
        onMouseLeave={() => {
          setIsCardHovered(false);
        }}
        onBlur={() => {
          setIsCardHovered(false);
        }}
      >
        <CardTitleWrapper backgroundGradient={cardTitleBackgroundGradient}>
          <div className='flex items-center gap-2'>
            <Display size='M' weight='semibold'>
              {token0.symbol} / {token1.symbol}
            </Display>
            <button onClick={() => setIsContractLinksModalOpen(true)}>
              <MoreIcon width={20} height={20} />
            </button>
          </div>
          <CardSubTitleWrapper>
            <TokenPairIcons
              token0IconPath={token0.logoURI}
              token1IconPath={token1.logoURI}
              token0AltText={`${token0.name}'s Icon`}
              token1AltText={`${token1.name}'s Icon`}
            />
            <FeeTierContainer feeTier={uniswapFeeTier} />
          </CardSubTitleWrapper>
        </CardTitleWrapper>
        <CardBodyWrapper>
          <CustomBodySubContainer>
            <div className='flex items-center gap-3'>
              <Text size='M' weight='medium'>
                {token0?.symbol}+
              </Text>
              <TokenAPYWrapper>
                <Text size='S' weight='medium'>
                  {roundPercentage(kitty0Info.lendAPY)}% APY
                </Text>
              </TokenAPYWrapper>
            </div>
            <LendTokenInfo token={token0} totalSupply={kitty0Info.inventory} utilization={kitty0Info.utilization} />
            {isCardHovered && (
              <EditPositionButton
                Icon={hasDeposited0 ? <EditIcon width={32} height={32} /> : <PlusIcon width={32} height={32} />}
                onClick={() => {
                  setIsEditToken0PositionModalOpen(true);
                }}
                disabled={!accountAddress}
              />
            )}
          </CustomBodySubContainer>
          <BodyDivider />
          <CustomBodySubContainer>
            <div className='flex items-center gap-3'>
              <Text size='M' weight='medium'>
                {token1?.symbol}+
              </Text>
              <TokenAPYWrapper>
                <Text size='S' weight='medium'>
                  {roundPercentage(kitty1Info.lendAPY)}% APY
                </Text>
              </TokenAPYWrapper>
            </div>
            <LendTokenInfo token={token1} totalSupply={kitty1Info.inventory} utilization={kitty1Info.utilization} />
            {isCardHovered && (
              <EditPositionButton
                Icon={hasDeposited1 ? <EditIcon width={32} height={32} /> : <PlusIcon width={32} height={32} />}
                onClick={() => {
                  setIsEditToken1PositionModalOpen(true);
                }}
                disabled={!accountAddress}
              />
            )}
          </CustomBodySubContainer>
        </CardBodyWrapper>
      </CardWrapper>
      <EditPositionModal
        token={token0}
        kitty={kitty0}
        isOpen={isEditToken0PositionModalOpen}
        setIsOpen={(open: boolean) => {
          setIsEditToken0PositionModalOpen(open);
        }}
      />
      <EditPositionModal
        token={token1}
        kitty={kitty1}
        isOpen={isEditToken1PositionModalOpen}
        setIsOpen={(open: boolean) => {
          setIsEditToken1PositionModalOpen(open);
        }}
      />
      <ContractLinksModal
        token0={token0}
        token1={token1}
        kitty0={kitty0}
        kitty1={kitty1}
        isOpen={isContractLinksModalOpen}
        setIsOpen={setIsContractLinksModalOpen}
      />
    </div>
  );
}
