import { useEffect, useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import axios, { AxiosResponse } from 'axios';
import JSBI from 'jsbi';
import { useNavigate, useParams } from 'react-router-dom';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import ArrowLeft from 'shared/lib/assets/svg/ArrowLeft';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BORROWER_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import useChain from 'shared/lib/data/hooks/UseChain';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import styled from 'styled-components';
import { Address } from 'viem';
import { Config, useAccount, useClient, usePublicClient, useReadContract } from 'wagmi';

import BoostCard from '../../components/boost/BoostCard';
import BurnBoostModal from '../../components/boost/BurnBoostModal';
import CollectFeesWidget from '../../components/boost/CollectFeesWidget';
import PendingTxnModal, { PendingTxnModalStatus } from '../../components/common/PendingTxnModal';
import { sqrtRatioToTick } from '../../data/BalanceSheet';
import { API_PRICE_RELAY_LATEST_URL } from '../../data/constants/Values';
import { PriceRelayLatestResponse } from '../../data/PriceRelayResponse';
import { BoostCardInfo, BoostCardType, fetchBoostBorrower } from '../../data/Uniboost';
import { getProminentColor, rgb } from '../../util/Colors';
import { useEthersProvider } from '../../util/Provider';
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
  const activeChain = useChain();
  const { nftTokenId } = useParams();
  const client = useClient<Config>({ chainId: activeChain.id });
  const provider = useEthersProvider(client);
  const [cardInfo, setCardInfo] = useChainDependentState<BoostCardInfo | null>(null, activeChain.id);
  const [tokenQuotes, setTokenQuotes] = useState<TokenPairQuotes | undefined>(undefined);
  const [colors, setColors] = useState<{ token0: string; token1: string } | undefined>(undefined);
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useState(false);
  const [pendingTxn, setPendingTxn] = useState<WriteContractReturnType | null>(null);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);
  const [isBurnModalOpen, setIsBurnModalOpen] = useState(false);
  const { address: userAddress } = useAccount();

  const navigate = useNavigate();

  const { data: tokenIds } = useReadContract({
    abi: borrowerNftAbi,
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    functionName: 'tokensOf',
    args: userAddress ? [userAddress] : undefined,
    chainId: activeChain.id,
    query: { enabled: Boolean(userAddress) },
  });
  const tokenPtr = useMemo(
    () => tokenIds?.findIndex((id) => `0x${id.toString(16)}` === nftTokenId) ?? null,
    [tokenIds, nftTokenId]
  );

  useEffect(() => {
    if (cardInfo?.borrower && JSBI.equal(cardInfo.position.liquidity, JSBI.BigInt(0))) {
      navigate('/boost');
    }
  }, [cardInfo, navigate]);

  const publicClient = usePublicClient({ chainId: activeChain.id });
  useEffect(() => {
    (async () => {
      if (!pendingTxn || !publicClient) return;
      setPendingTxnModalStatus(PendingTxnModalStatus.PENDING);
      setIsPendingTxnModalOpen(true);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: pendingTxn,
      });
      if (receipt.status === 'success') {
        setPendingTxnModalStatus(PendingTxnModalStatus.SUCCESS);
      } else {
        setPendingTxnModalStatus(PendingTxnModalStatus.FAILURE);
      }
    })();
  }, [publicClient, pendingTxn, setIsPendingTxnModalOpen, setPendingTxnModalStatus]);

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
    // Using tokenPtr == null rather than !tokenPtr because tokenPtr can be 0
    if (!borrowerAddress || !nftTokenId || !userAddress || tokenPtr == null || !provider) return;
    (async () => {
      const res = await fetchBoostBorrower(activeChain.id, provider, borrowerAddress as Address);
      const boostCardInfo = new BoostCardInfo(
        BoostCardType.BOOST_NFT,
        userAddress,
        nftTokenId,
        tokenPtr,
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
  }, [userAddress, activeChain.id, tokenPtr, borrowerAddress, nftTokenId, provider, setCardInfo]);

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
          <div className='flex-grow flex-col'>
            <CollectFeesWidget cardInfo={cardInfo} tokenQuotes={tokenQuotes} setPendingTxn={setPendingTxn} />
            <Text size='S' className='text-center underline mt-4 max-w-[500px]'>
              <a href={`/borrow?account=${cardInfo.borrower?.address}`}>Advanced View</a>
            </Text>
          </div>
        </Container>
      )}
      {cardInfo && isBurnModalOpen && (
        <BurnBoostModal
          isOpen={isBurnModalOpen}
          cardInfo={cardInfo}
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
        txnHash={pendingTxn}
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
