import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import axios, { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { useNavigate, useParams } from 'react-router-dom';
import { boostNftAbi } from 'shared/lib/abis/BoostNFT';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BOOST_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN } from 'shared/lib/data/GoodNumber';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import styled from 'styled-components';
import { Address, useContractRead, useContractWrite, usePrepareContractWrite, useProvider } from 'wagmi';

import { ChainContext } from '../../App';
import BoostCard from '../../components/boost/BoostCard';
import CollectFeesWidget from '../../components/boost/CollectFeesWidget';
import PendingTxnModal, { PendingTxnModalStatus } from '../../components/common/PendingTxnModal';
import { sqrtRatioToTick } from '../../data/BalanceSheet';
import { API_PRICE_RELAY_LATEST_URL } from '../../data/constants/Values';
import { MarginAccount } from '../../data/MarginAccount';
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
  /* justify-content: space-between; */
  flex-wrap: wrap;
  gap: 20px;
`;

function calculateShortfall(borrower: MarginAccount): { shortfall0: GN; shortfall1: GN } {
  if (!borrower) return { shortfall0: GN.zero(0), shortfall1: GN.zero(0) };
  const { assets, liabilities } = borrower;
  return {
    shortfall0: GN.fromNumber(liabilities.amount0 - (assets.token0Raw + assets.uni0), borrower.token0.decimals),
    shortfall1: GN.fromNumber(liabilities.amount1 - (assets.token1Raw + assets.uni1), borrower.token1.decimals),
  };
}

function computeData(borrower?: MarginAccount, slippage = 0.01) {
  if (borrower) {
    const { shortfall0, shortfall1 } = calculateShortfall(borrower);
    const sqrtPrice = new GN(borrower.sqrtPriceX96.toFixed(0), 96, 2);

    if (shortfall0.isGtZero()) {
      const worstPrice = sqrtPrice.square().recklessMul(1 + slippage);
      return {
        maxSpend: shortfall0.setResolution(borrower.token1.decimals).mul(worstPrice),
        zeroForOne: false,
      };
    }
    if (shortfall1.isGtZero()) {
      const worstPrice = sqrtPrice.square().recklessDiv(1 + slippage);
      return {
        maxSpend: shortfall1.setResolution(borrower.token0.decimals).div(worstPrice),
        zeroForOne: true,
      };
    }
  }
  return {
    maxSpend: GN.zero(0),
    zeroForOne: false,
  };
}

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
    if (cardInfo?.borrower && JSBI.equal(cardInfo.position.liquidity, JSBI.BigInt(0))) {
      navigate('/boost');
    }
  }, [cardInfo, navigate]);

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

  const modifyData = useMemo(() => {
    const { maxSpend, zeroForOne } = computeData(cardInfo?.borrower || undefined);
    return ethers.utils.defaultAbiCoder.encode(
      ['int24', 'int24', 'uint128', 'uint128', 'bool'],
      [
        cardInfo?.position.lower || 0,
        cardInfo?.position.upper || 0,
        cardInfo?.position.liquidity.toString(10) || 0,
        maxSpend.toBigNumber(),
        zeroForOne,
      ]
    ) as `0x${string}`;
  }, [cardInfo]);

  const { config: configBurn } = usePrepareContractWrite({
    address: ALOE_II_BOOST_NFT_ADDRESS[activeChain.id],
    abi: boostNftAbi,
    functionName: 'modify',
    args: [ethers.BigNumber.from(nftTokenId || 0), 2, modifyData, [true, true]],
    chainId: activeChain.id,
    enabled: nftTokenId !== undefined && cardInfo != null && !JSBI.equal(cardInfo?.position.liquidity, JSBI.BigInt(0)),
  });
  let gasLimit = configBurn.request?.gasLimit.mul(110).div(100);
  const {
    write: burn,
    data: burnTxn,
    isLoading: burnIsLoading,
    isSuccess: burnDidSucceed,
  } = useContractWrite({
    ...configBurn,
    request: {
      ...configBurn.request,
      gasLimit,
    },
  });

  useEffect(() => {
    if (burnDidSucceed && burnTxn) {
      setPendingTxn(burnTxn);
    }
  }, [burnDidSucceed, burnTxn, burnIsLoading, setPendingTxn]);

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
      <div className='flex gap-10 mb-4'>
        <Text size='XL'>Manage Boost</Text>
        <FilledGradientButton
          size='S'
          onClick={() => {
            burn?.();
          }}
        >
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
