import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { FeeTier } from '../../data/BlendPoolMarkers';
import { TokenData } from '../../data/TokenData';
import {
  getBrighterColor,
  getProminentColor,
  rgb,
  rgba,
} from '../../util/Colors';
import FeeTierContainer from '../common/FeeTierContainer';
import TokenPairIcons from '../common/TokenPairIcons';
import { Display, Text } from '../common/Typography';
import { roundPercentage } from '../../util/Numbers';
import LendTokenInfo from './LendTokenInfo';
import {
  BodyDivider,
  BodySubContainer,
  CardBodyWrapper,
  CardSubTitleWrapper,
  CardTitleWrapper,
  CardWrapper,
} from '../common/Card';
import tw from 'twin.macro';
import { ReactComponent as PlusIcon } from '../../assets/svg/plus.svg';
import { ReactComponent as EditIcon } from '../../assets/svg/edit.svg';
import AddPositionModal from './modal/AddPositionModal';
import EditPositionModal from './modal/EditPositionModal';
// import ConfirmModal, { ConfirmationType } from './modal/ConfirmModalState';

const TOKEN_APY_BG_COLOR = 'rgb(29, 41, 53)';

const TokenAPYWrapper = styled.div`
  padding: 2px 8px;
  border-radius: 8px;
  background-color: ${TOKEN_APY_BG_COLOR};
`;

const CustomBodySubContainer = styled(BodySubContainer)`
  position: relative;
  padding-right: 80px;
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
`;

function AddPositionButton(props: { onClick?: () => void }) {
  return (
    <CardActionButton onClick={props?.onClick}>
      <PlusIcon width={32} height={32} />
    </CardActionButton>
  );
}

function EditPositionButton(props: { onClick?: () => void }) {
  return (
    <CardActionButton onClick={props?.onClick}>
      <EditIcon width={32} height={32} />
    </CardActionButton>
  );
}

export type LendPairCardProps = {
  token0: TokenData;
  token1: TokenData;
  token0APY: number;
  token1APY: number;
  token0TotalSupply: number;
  token1TotalSupply: number;
  token0Utilization: number;
  token1Utilization: number;
  uniswapFeeTier: FeeTier;
};

export default function LendPairCard(props: LendPairCardProps) {
  const {
    token0,
    token1,
    token0APY,
    token1APY,
    token0TotalSupply,
    token1TotalSupply,
    token0Utilization,
    token1Utilization,
    uniswapFeeTier,
  } = props;
  const [isAddToken0PositionModalOpen, setIsAddToken0PositionModalOpen] =
    useState<boolean>(false);
  const [isAddToken1PositionModalOpen, setIsAddToken1PositionModalOpen] =
    useState<boolean>(false);
  const [isEditToken0PositionModalOpen, setIsEditToken0PositionModalOpen] =
    useState<boolean>(false);
  const [isEditToken1PositionModalOpen, setIsEditToken1PositionModalOpen] =
    useState<boolean>(false);
  const [isCardHovered, setIsCardHovered] = useState<boolean>(false);
  const [token0Color, setToken0Color] = useState<string>('');
  const [token1Color, setToken1Color] = useState<string>('');
  useEffect(() => {
    let mounted = true;
    getProminentColor(token0.iconPath || '').then((color) => {
      if (mounted) {
        setToken0Color(color);
      }
    });
    getProminentColor(token1.iconPath || '').then((color) => {
      if (mounted) {
        setToken1Color(color);
      }
    });
    return () => {
      mounted = false;
    };
  });
  // Create the variables for the gradients.
  const cardTitleBackgroundGradient = `linear-gradient(90deg, ${rgba(
    token0Color,
    0.25
  )} 0%, ${rgba(token1Color, 0.25)} 100%)`;
  const cardBorderGradient = `linear-gradient(90deg, ${rgb(
    token0Color
  )} 0%, ${rgb(token1Color)} 100%)`;
  const cardShadowColor = rgba(
    getBrighterColor(token0Color, token1Color),
    0.16
  );

  // Hard-coded for now...
  const token0Position = 0;
  const token1Position = 1000;

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
          <Display size='M' weight='semibold'>
            {token0.ticker} / {token1.ticker}
          </Display>
          <CardSubTitleWrapper>
            <TokenPairIcons
              token0IconPath={token0.iconPath}
              token1IconPath={token1.iconPath}
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
                {token0?.ticker}+
              </Text>
              <TokenAPYWrapper>
                <Text size='S' weight='medium'>
                  {roundPercentage(token0APY)}% APY
                </Text>
              </TokenAPYWrapper>
            </div>
            <LendTokenInfo
              totalSupply={token0TotalSupply}
              utilization={token0Utilization}
            />
            {isCardHovered &&
              (token0Position > 0 ? (
                <EditPositionButton
                  onClick={() => {
                    setIsEditToken0PositionModalOpen(true);
                  }}
                />
              ) : (
                <AddPositionButton
                  onClick={() => {
                    setIsAddToken0PositionModalOpen(true);
                  }}
                />
              ))}
          </CustomBodySubContainer>
          <BodyDivider />
          <CustomBodySubContainer>
            <div className='flex items-center gap-3'>
              <Text size='M' weight='medium'>
                {token1?.ticker}+
              </Text>
              <TokenAPYWrapper>
                <Text size='S' weight='medium'>
                  {roundPercentage(token1APY)}% APY
                </Text>
              </TokenAPYWrapper>
            </div>
            <LendTokenInfo
              totalSupply={token1TotalSupply}
              utilization={token1Utilization}
            />
            {isCardHovered &&
              (token1Position > 0 ? (
                <EditPositionButton
                  onClick={() => {
                    setIsEditToken1PositionModalOpen(true);
                  }}
                />
              ) : (
                <AddPositionButton
                  onClick={() => {
                    setIsAddToken1PositionModalOpen(true);
                  }}
                />
              ))}
          </CustomBodySubContainer>
        </CardBodyWrapper>
      </CardWrapper>
      <AddPositionModal
        token={token0}
        open={isAddToken0PositionModalOpen}
        setOpen={(open: boolean) => {
          setIsAddToken0PositionModalOpen(open);
        }}
        onConfirm={() => {
          setIsAddToken0PositionModalOpen(false);
        }}
        onCancel={() => {
          setIsAddToken0PositionModalOpen(false);
        }}
      />
      <AddPositionModal
        token={token1}
        open={isAddToken1PositionModalOpen}
        setOpen={(open: boolean) => {
          setIsAddToken1PositionModalOpen(open);
        }}
        onConfirm={() => {
          setIsAddToken1PositionModalOpen(false);
        }}
        onCancel={() => {
          setIsAddToken1PositionModalOpen(false);
        }}
      />
      <EditPositionModal
        token={token0}
        open={isEditToken0PositionModalOpen}
        setOpen={(open: boolean) => {
          setIsEditToken0PositionModalOpen(open);
        }}
        onConfirm={() => {
          setIsEditToken0PositionModalOpen(false);
        }}
        onCancel={() => {
          setIsEditToken0PositionModalOpen(false);
        }}
      />
      <EditPositionModal
        token={token1}
        open={isEditToken1PositionModalOpen}
        setOpen={(open: boolean) => {
          setIsEditToken1PositionModalOpen(open);
        }}
        onConfirm={() => {
          setIsEditToken1PositionModalOpen(false);
        }}
        onCancel={() => {
          setIsEditToken1PositionModalOpen(false);
        }}
      />
    </div>
  );
}
