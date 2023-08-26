import { useContext, useEffect, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import axios, { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import { useNavigate, useParams } from 'react-router-dom';
import { boostNftAbi } from 'shared/lib/abis/BoostNFT';
import AppPage from 'shared/lib/components/common/AppPage';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BOOST_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import styled from 'styled-components';
import { Address, useContractRead, useProvider } from 'wagmi';

import { ChainContext } from '../../App';
import BoostCard from '../../components/boost/BoostCard';
import CollectFeesWidget from '../../components/boost/CollectFeesWidget';
import PendingTxnModal, { PendingTxnModalStatus } from '../../components/common/PendingTxnModal';
import { sqrtRatioToTick } from '../../data/BalanceSheet';
import { API_PRICE_RELAY_LATEST_URL } from '../../data/constants/Values';
import { PriceRelayLatestResponse } from '../../data/PriceRelayResponse';
import { BoostCardInfo, BoostCardType, fetchBoostBorrower } from '../../data/Uniboost';

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
  const [tokenQuotes, setTokenQuotes] = useState<TokenPairQuotes>();
  const [isPendingTxnModalOpen, setIsPendingTxnModalOpen] = useState(false);
  const [pendingTxn, setPendingTxn] = useState<SendTransactionResult | null>(null);
  const [pendingTxnModalStatus, setPendingTxnModalStatus] = useState<PendingTxnModalStatus | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function waitForTxn() {
      if (!pendingTxn) return;
      setPendingTxnModalStatus(PendingTxnModalStatus.PENDING);
      setIsPendingTxnModalOpen(true);
      const receipt = await pendingTxn.wait();
      if (!mounted) return;
      if (receipt.status === 1) {
        setPendingTxnModalStatus(PendingTxnModalStatus.SUCCESS);
      } else {
        setPendingTxnModalStatus(PendingTxnModalStatus.FAILURE);
      }
    }
    waitForTxn();
    return () => {
      mounted = false;
    };
  }, [pendingTxn]);

  useEffect(() => {
    let mounted = true;
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
      if (mounted) {
        setTokenQuotes({ token0Price, token1Price });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [cardInfo]);

  const { data: boostNftAttributes } = useContractRead({
    abi: boostNftAbi,
    address: ALOE_II_BOOST_NFT_ADDRESS[activeChain.id],
    functionName: 'attributesOf',
    args: [ethers.BigNumber.from(nftTokenId || 0)],
    enabled: nftTokenId !== undefined,
  });

  const borrowerAddress = boostNftAttributes?.borrower;

  useEffect(() => {
    let mounted = true;
    if (!borrowerAddress || !nftTokenId) return;
    (async () => {
      const res = await fetchBoostBorrower(activeChain.id, provider, borrowerAddress as Address);
      const boostCardInfo = new BoostCardInfo(
        BoostCardType.BOOST_NFT,
        nftTokenId,
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
      if (mounted) {
        setCardInfo(boostCardInfo);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeChain.id, borrowerAddress, nftTokenId, provider, setCardInfo]);

  const isLoading = !cardInfo || !nftTokenId;
  return (
    <AppPage>
      <div className='mb-4'>
        <Text size='XL'>Manage Boost</Text>
      </div>
      {!isLoading && (
        <Container>
          <BoostCard info={cardInfo} uniqueId={nftTokenId} isDisplayOnly={true} />
          <div className='flex-grow'>
            <CollectFeesWidget cardInfo={cardInfo} tokenQuotes={tokenQuotes} setPendingTxn={setPendingTxn} />
          </div>
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
            navigate(0);
          }, 100);
        }}
        status={pendingTxnModalStatus}
      />
    </AppPage>
  );
}
