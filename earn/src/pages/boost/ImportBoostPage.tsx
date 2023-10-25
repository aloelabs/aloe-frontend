import { useContext, useEffect, useMemo, useState } from 'react';

import { TickMath } from '@uniswap/v3-sdk';
import { SendTransactionResult } from '@wagmi/core';
import { useNavigate, useParams } from 'react-router-dom';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { uniswapV3PoolAbi } from 'shared/lib/abis/UniswapV3Pool';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import ArrowLeft from 'shared/lib/assets/svg/ArrowLeft';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { RESPONSIVE_BREAKPOINT_TABLET } from 'shared/lib/data/constants/Breakpoints';
import { ALOE_II_FACTORY_ADDRESS, ALOE_II_ORACLE_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GREY_800 } from 'shared/lib/data/constants/Colors';
import { Q32 } from 'shared/lib/data/constants/Values';
import { FeeTier } from 'shared/lib/data/FeeTier';
import { GN } from 'shared/lib/data/GoodNumber';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import useSafeState from 'shared/lib/data/hooks/UseSafeState';
import styled from 'styled-components';
import { useContractRead, useProvider } from 'wagmi';

import { ChainContext } from '../../App';
import BoostCard from '../../components/boost/BoostCard';
import ImportBoostWidget from '../../components/boost/ImportBoostWidget';
import PendingTxnModal, { PendingTxnModalStatus } from '../../components/common/PendingTxnModal';
import { BoostCardInfo, BoostCardType } from '../../data/Uniboost';
import { UniswapNFTPosition, computePoolAddress, fetchUniswapNFTPosition } from '../../data/Uniswap';
import { getProminentColor, rgb } from '../../util/Colors';
import { BackButtonWrapper } from '../BoostPage';

export const BOOST_MIN = 1;
export const BOOST_MAX = 5;
export const BOOST_DEFAULT = BOOST_MIN;
const DEFAULT_COLOR0 = 'white';
const DEFAULT_COLOR1 = 'white';

const Container = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  max-width: fit-content;
  margin: 0 auto;
  background-color: ${GREY_800};
  border-radius: 8px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_TABLET}) {
    flex-direction: column;
    align-items: center;
  }
`;

const BoostCardWrapper = styled.div`
  display: flex;
  align-items: center;
  padding-left: 40px;
  @media (max-width: ${RESPONSIVE_BREAKPOINT_TABLET}) {
    padding: 0px;
    padding-top: 20px;
  }
`;

export default function ImportBoostPage() {
  const { activeChain } = useContext(ChainContext);
  const { tokenId } = useParams();
  const provider = useProvider({ chainId: activeChain.id });
  const [uniswapNftPosition, setUniswapNftPosition] = useChainDependentState<UniswapNFTPosition | undefined>(
    undefined,
    activeChain.id
  );
  const [colors, setColors] = useSafeState<{ token0: string; token1: string } | undefined>(undefined);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useSafeState(false);
  const [pendingTxn, setPendingTxn] = useState<SendTransactionResult | null>(null);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useSafeState<PendingTxnModalStatus | null>(null);
  const [boostFactor, setBoostFactor] = useState<number>(BOOST_DEFAULT);

  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      if (!pendingTxn) return;
      setPendingTxnModalStatus(PendingTxnModalStatus.PENDING);
      setIsPendingTxnModalOpen(true);
      const receipt = await pendingTxn.wait();
      if (receipt.status === 1) {
        setPendingTxnModalStatus(PendingTxnModalStatus.SUCCESS);
      } else {
        setPendingTxnModalStatus(PendingTxnModalStatus.FAILURE);
      }
    })();
  }, [pendingTxn, setIsPendingTxnModalOpen, setPendingTxnModalStatus]);

  useEffect(() => {
    (async () => {
      if (!uniswapNftPosition) return;
      const tokenColors = await Promise.all(
        [uniswapNftPosition.token0.logoURI, uniswapNftPosition.token1.logoURI].map((logoURI) => {
          return getProminentColor(logoURI);
        })
      );
      setColors({ token0: rgb(tokenColors[0]), token1: rgb(tokenColors[1]) });
    })();
  }, [setColors, uniswapNftPosition]);

  useEffect(() => {
    (async () => {
      const fetchedUniswapNFTPosition = await fetchUniswapNFTPosition(Number(tokenId), provider);
      setUniswapNftPosition(fetchedUniswapNFTPosition);
    })();
  }, [tokenId, provider, setUniswapNftPosition]);

  const poolAddress = useMemo(() => {
    if (!uniswapNftPosition) return undefined;
    return computePoolAddress({
      chainId: activeChain.id,
      token0: uniswapNftPosition.token0,
      token1: uniswapNftPosition.token1,
      fee: uniswapNftPosition.fee,
    });
  }, [uniswapNftPosition, activeChain.id]);

  const { data: slot0 } = useContractRead({
    abi: uniswapV3PoolAbi,
    address: poolAddress,
    functionName: 'slot0',
    chainId: activeChain.id,
    enabled: Boolean(poolAddress),
  });

  const { data: marketData } = useContractRead({
    abi: factoryAbi,
    address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
    functionName: 'getMarket',
    args: [poolAddress || '0x'],
    enabled: Boolean(poolAddress),
  });

  const cardInfo: BoostCardInfo | undefined = useMemo(() => {
    if (!uniswapNftPosition || !poolAddress || !slot0 || !marketData) return undefined;
    const currentTick = slot0.tick;
    return new BoostCardInfo(
      BoostCardType.UNISWAP_NFT,
      uniswapNftPosition.tokenId,
      -1, // TODO:
      poolAddress,
      currentTick,
      uniswapNftPosition.token0,
      uniswapNftPosition.token1,
      marketData.lender0,
      marketData.lender1,
      colors?.token0 || DEFAULT_COLOR0,
      colors?.token1 || DEFAULT_COLOR1,
      uniswapNftPosition,
      {
        amount0: GN.zero(0),
        amount1: GN.zero(0),
      },
      null
    );
  }, [uniswapNftPosition, poolAddress, slot0, marketData, colors]);

  const { data: consultData } = useContractRead({
    abi: volatilityOracleAbi,
    address: ALOE_II_ORACLE_ADDRESS[activeChain.id],
    functionName: 'consult',
    args: [cardInfo?.uniswapPool ?? '0x', Q32],
    enabled: Boolean(cardInfo),
  });

  const { data: parametersData } = useContractRead({
    abi: factoryAbi,
    address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
    functionName: 'getParameters',
    args: [cardInfo?.uniswapPool ?? '0x'],
    enabled: Boolean(cardInfo),
  });

  let iv = GN.hexToGn(consultData?.[2].toHexString() ?? '0x0', 12).toNumber();
  const nSigma = (parametersData?.['nSigma'] ?? 0) / 10;

  const updatedCardInfo: BoostCardInfo | undefined = useMemo(() => {
    if (!cardInfo) return undefined;
    const { position } = cardInfo;

    const updatedLiquidity = GN.fromJSBI(position.liquidity, 0).recklessMul(boostFactor).toJSBI();
    return BoostCardInfo.from(
      cardInfo,
      {
        address: '0x',
        uniswapPool: cardInfo.uniswapPool,
        token0: cardInfo.token0,
        token1: cardInfo.token1,
        assets: {
          token0Raw: 0,
          token1Raw: 0,
          uni0: 0,
          uni1: 0,
        },
        liabilities: {
          amount0: cardInfo.amount0() * (boostFactor - 1),
          amount1: cardInfo.amount1() * (boostFactor - 1),
        },
        feeTier: FeeTier.INVALID,
        sqrtPriceX96: GN.fromJSBI(TickMath.getSqrtRatioAtTick(cardInfo.currentTick), 0).toDecimalBig(),
        health: 0,
        lender0: '0x',
        lender1: '0x',
        iv,
        nSigma,
      },
      {
        ...position,
        liquidity: updatedLiquidity,
      }
    );
  }, [cardInfo, boostFactor, iv, nSigma]);

  const isLoading = !cardInfo || !updatedCardInfo || !tokenId;
  return (
    <AppPage>
      <div className='flex items-center gap-2 mb-6'>
        <BackButtonWrapper onClick={() => navigate('/boost')}>
          <ArrowLeft />
          <Text size='L' weight='regular' color='inherit'>
            Positions
          </Text>
        </BackButtonWrapper>
      </div>
      {!isLoading && (
        <Container>
          <BoostCardWrapper>
            <BoostCard info={updatedCardInfo} uniqueId={tokenId} isDisplayOnly={true} />
          </BoostCardWrapper>
          <ImportBoostWidget
            cardInfo={cardInfo}
            boostFactor={boostFactor}
            iv={iv}
            setBoostFactor={setBoostFactor}
            setPendingTxn={setPendingTxn}
          />
        </Container>
      )}
      <PendingTxnModal
        isOpen={isPendingTxnModalOpen}
        setIsOpen={(isOpen: boolean) => {
          setIsPendingTxnModalOpen(isOpen);
          if (!isOpen) {
            setPendingTxn(null);
          }
        }}
        txnHash={pendingTxn?.hash}
        onConfirm={() => {
          setIsPendingTxnModalOpen(false);
          setTimeout(() => {
            navigate('/boost');
          }, 100);
        }}
        status={pendingTxnModalStatus}
      />
    </AppPage>
  );
}
