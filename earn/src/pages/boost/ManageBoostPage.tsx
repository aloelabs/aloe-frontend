import { useContext, useEffect, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import axios, { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { useNavigate, useParams } from 'react-router-dom';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import ArrowLeft from 'shared/lib/assets/svg/ArrowLeft';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BORROWER_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import useSafeState from 'shared/lib/data/hooks/UseSafeState';
import styled from 'styled-components';
import { Address, useContractRead, useProvider } from 'wagmi';

import { ChainContext } from '../../App';
import BoostCard from '../../components/boost/BoostCard';
import BurnBoostModal from '../../components/boost/BurnBoostModal';
import CollectFeesWidget from '../../components/boost/CollectFeesWidget';
import PendingTxnModal, { PendingTxnModalStatus } from '../../components/common/PendingTxnModal';
import { sqrtRatioToTick } from '../../data/BalanceSheet';
import { API_PRICE_RELAY_LATEST_URL } from '../../data/constants/Values';
import { PriceRelayLatestResponse } from '../../data/PriceRelayResponse';
import { BoostCardInfo, BoostCardType, fetchBoostBorrower } from '../../data/Uniboost';
import { getProminentColor, rgb } from '../../util/Colors';
import { BackButtonWrapper } from '../BoostPage';

const DEFAULT_COLOR0 = 'white';
const DEFAULT_COLOR1 = 'white';

export type TokenPairQuotes = {
  token0Price: number;
  token1Price: number;
};

const Container = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
`;

export default function ManageBoostPage() {
  const { activeChain } = useContext(ChainContext);
  const { nftTokenId } = useParams();
  const provider = useProvider({ chainId: activeChain.id });
  const [cardInfo, setCardInfo] = useChainDependentState<BoostCardInfo | null>(null, activeChain.id);
  const [tokenQuotes, setTokenQuotes] = useSafeState<TokenPairQuotes | undefined>(undefined);
  const [colors, setColors] = useSafeState<{ token0: string; token1: string } | undefined>(undefined);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useSafeState(false);
  const [pendingTxn, setPendingTxn] = useState<SendTransactionResult | null>(null);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useSafeState<PendingTxnModalStatus | null>(null);
  const [isBurnModalOpen, setIsBurnModalOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (cardInfo?.borrower && JSBI.equal(cardInfo.position.liquidity, JSBI.BigInt(0))) {
      navigate('/boost');
    }
  }, [cardInfo, navigate]);

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
      if (!cardInfo) return;
      const tokenColors = await Promise.all(
        [cardInfo.token0.logoURI, cardInfo.token1.logoURI].map((logoURI) => {
          return getProminentColor(logoURI);
        })
      );
      setColors({ token0: rgb(tokenColors[0]), token1: rgb(tokenColors[1]) });
    })();
  }, [cardInfo, setColors]);

  useEffect(() => {
    if (!cardInfo) return;
    (async () => {
      let quoteDataResponse: AxiosResponse<PriceRelayLatestResponse>;
      try {
        quoteDataResponse = await axios.get(
          `${API_PRICE_RELAY_LATEST_URL}?symbols=${cardInfo.token0.symbol},${cardInfo.token1.symbol}`
        );
      } catch {
        return;
      }
      const token0Price = quoteDataResponse.data[cardInfo.token0.symbol].price;
      const token1Price = quoteDataResponse.data[cardInfo.token1.symbol].price;
      setTokenQuotes({ token0Price, token1Price });
    })();
  }, [cardInfo, setTokenQuotes]);

  const borrowerAddress = nftTokenId?.slice(0, 42);

  useEffect(() => {
    if (!borrowerAddress || !nftTokenId) return;
    (async () => {
      const res = await fetchBoostBorrower(activeChain.id, provider, borrowerAddress as Address);
      const boostCardInfo = new BoostCardInfo(
        BoostCardType.BOOST_NFT,
        nftTokenId,
        -1, // TODO:
        res.borrower.uniswapPool as Address,
        sqrtRatioToTick(res.borrower.sqrtPriceX96),
        res.borrower.token0,
        res.borrower.token1,
        res.borrower.lender0,
        res.borrower.lender1,
        DEFAULT_COLOR0,
        DEFAULT_COLOR1,
        res.uniswapPosition,
        res.uniswapFees,
        res.borrower
      );
      setCardInfo(boostCardInfo);
    })();
  }, [activeChain.id, borrowerAddress, nftTokenId, provider, setCardInfo]);

  // Handled separately from the above useEffect because we don't want to re-fetch the borrower
  useEffect(() => {
    if (!cardInfo || !colors?.token0 || !colors?.token1) return;
    if (cardInfo.color0 === colors.token0 || cardInfo.color1 === colors.token1) return;
    const boostCardWithColors = BoostCardInfo.withColors(cardInfo, colors.token0, colors.token1);
    setCardInfo(boostCardWithColors);
  }, [cardInfo, colors?.token0, colors?.token1, setCardInfo]);

  const isLoading = !cardInfo || !nftTokenId;
  return (
    <AppPage>
      <div className='flex items-center gap-2 mb-4'>
        <BackButtonWrapper onClick={() => navigate('/boost')}>
          <ArrowLeft />
          <Text size='L' weight='regular' color='inherit'>
            Positions
          </Text>
        </BackButtonWrapper>
        <FilledGradientButton size='S' onClick={() => setIsBurnModalOpen(true)} className='ml-8'>
          Burn
        </FilledGradientButton>
      </div>
      {!isLoading && (
        <Container>
          <BoostCard info={cardInfo} uniqueId={nftTokenId} isDisplayOnly={true} />
          <div className='flex-grow'>
            <CollectFeesWidget cardInfo={cardInfo} tokenQuotes={tokenQuotes} setPendingTxn={setPendingTxn} />
          </div>
        </Container>
      )}
      {cardInfo && isBurnModalOpen && (
        <BurnBoostModal
          isOpen={isBurnModalOpen}
          cardInfo={cardInfo}
          nftTokenId={nftTokenId}
          setIsOpen={() => {
            setIsBurnModalOpen(false);
          }}
          setPendingTxn={setPendingTxn}
        />
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
            navigate(0);
          }, 100);
        }}
        status={pendingTxnModalStatus}
      />
    </AppPage>
  );
}
