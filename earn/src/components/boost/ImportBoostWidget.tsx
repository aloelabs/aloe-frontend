import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { ethers } from 'ethers';
import { boostNftAbi } from 'shared/lib/abis/BoostNFT';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import { Text, Display } from 'shared/lib/components/common/Typography';
import {
  ALOE_II_BOOST_NFT_ADDRESS,
  ALOE_II_LENDER_LENS_ADDRESS,
  ANTES,
  UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { GREY_800 } from 'shared/lib/data/constants/Colors';
import { GN } from 'shared/lib/data/GoodNumber';
import { formatTokenAmount } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import {
  erc721ABI,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useProvider,
  useWaitForTransaction,
} from 'wagmi';

import { ChainContext } from '../../App';
import KittyLensAbi from '../../assets/abis/KittyLens.json';
import { fetchMarketInfoFor, MarketInfo } from '../../data/MarketInfo';
import { RateModel, yieldPerSecondToAPR } from '../../data/RateModel';
import { BoostCardInfo } from '../../data/Uniboost';
import { BOOST_MAX, BOOST_MIN } from '../../pages/boost/ImportBoostPage';

const SECONDARY_COLOR = '#CCDFED';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  width: 100%;
  background-color: ${GREY_800};
  border-radius: 8px;
  max-width: 450px;
  text-align: center;
`;

const SliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 300px;
  text-align: center;
  margin: 0 auto;
`;

const StyledDatalist = styled.datalist`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-top: 8px;
  width: 223px;
  margin-left: auto;
  margin-right: auto;

  option {
    color: #ffffff;
    position: relative;
    width: 25px;
  }

  option::before {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: -8px;
    width: 2px;
    height: 4px;
    background-color: #ffffff;
  }
`;

const LeverageSlider = styled.input`
  appearance: none;
  -webkit-appearance: none;
  height: 7px;
  background: #ffffff;
  border-radius: 0px;
  background-repeat: no-repeat;
  width: 200px;
  margin: 0 auto;
  cursor: pointer;

  &::-webkit-slider-thumb {
    position: relative;
    -webkit-appearance: none;
    margin-top: -16px;
    height: 16px;
    width: 4px;
    background: #4197ff;
    z-index: 1;
    cursor: pointer;
  }

  &::-webkit-slider-runnable-track {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    box-shadow: none;
    border: none;
    background: transparent;
  }
`;

enum ImportState {
  READY_TO_APPROVE,
  ASKING_USER_TO_APPROVE,
  APPROVING,
  READY_TO_MINT,
  ASKING_USER_TO_MINT,
}

function getImportButtonState(state?: ImportState) {
  switch (state) {
    case ImportState.READY_TO_APPROVE:
      return { isDisabled: false, label: 'Approve' };
    case ImportState.ASKING_USER_TO_APPROVE:
      return { isDisabled: true, label: 'Approve' };
    case ImportState.APPROVING:
      return { isDisabled: true, label: 'Approving...' };
    case ImportState.READY_TO_MINT:
      return { isDisabled: false, label: 'Mint' };
    case ImportState.ASKING_USER_TO_MINT:
      return { isDisabled: true, label: 'Mint' };
    default:
      return { isDisabled: true, label: 'Loading...' };
  }
}

export type ImportBoostWidgetProps = {
  cardInfo: BoostCardInfo;
  boostFactor: number;
  setBoostFactor: (boostFactor: number) => void;
  setPendingTxn: (txn: SendTransactionResult | null) => void;
};

export default function ImportBoostWidget(props: ImportBoostWidgetProps) {
  const { cardInfo, boostFactor, setBoostFactor, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [marketInfo, setMarketInfo] = useState<MarketInfo | null>(null);

  const provider = useProvider({ chainId: activeChain.id });

  // Generate labels for input range (slider)
  const labels: string[] = [];
  for (let i = BOOST_MIN; i <= BOOST_MAX; i += 1) {
    if (i % 2 !== 0) {
      labels.push(`${i.toFixed(0)}x`);
    } else {
      labels.push('');
    }
  }

  useEffect(() => {
    let isMounted = true;
    async function fetchMarketInfo() {
      // Checking each of these individually since we don't want to fetch market info when the boost factor changes
      if (!provider || !cardInfo.lender0 || !cardInfo.lender1 || !cardInfo.token0 || !cardInfo.token1) return;
      const lenderLensContract = new ethers.Contract(
        ALOE_II_LENDER_LENS_ADDRESS[activeChain.id],
        KittyLensAbi,
        provider
      );
      const marketInfo = await fetchMarketInfoFor(
        lenderLensContract,
        cardInfo.lender0,
        cardInfo.lender1,
        cardInfo.token0.decimals,
        cardInfo.token1.decimals
      );
      if (isMounted) {
        setMarketInfo(marketInfo);
      }
    }
    fetchMarketInfo();
    return () => {
      isMounted = false;
    };
  }, [activeChain.id, cardInfo.lender0, cardInfo.lender1, cardInfo.token0, cardInfo.token1, provider, setMarketInfo]);

  const { apr0, apr1 } = useMemo(() => {
    if (!marketInfo) {
      return { apr0: null, apr1: null };
    }
    const borrowAmount0 = GN.fromNumber(cardInfo.amount0() * (boostFactor - 1), cardInfo.token0.decimals);
    const borrowAmount1 = GN.fromNumber(cardInfo.amount1() * (boostFactor - 1), cardInfo.token1.decimals);

    const availableAssets0 = marketInfo.lender0AvailableAssets;
    const availableAssets1 = marketInfo.lender1AvailableAssets;
    const remainingAvailableAssets0 = availableAssets0.sub(borrowAmount0);
    const remainingAvailableAssets1 = availableAssets1.sub(borrowAmount1);

    const lenderTotalAssets0 = marketInfo.lender0TotalAssets;
    const lenderTotalAssets1 = marketInfo.lender1TotalAssets;

    const newUtilization0 = lenderTotalAssets0.isGtZero()
      ? 1 - remainingAvailableAssets0.div(lenderTotalAssets0).toNumber()
      : 0;

    const newUtilization1 = lenderTotalAssets1.isGtZero()
      ? 1 - remainingAvailableAssets1.div(lenderTotalAssets1).toNumber()
      : 0;

    const apr0 = yieldPerSecondToAPR(RateModel.computeYieldPerSecond(newUtilization0)) * 100;
    const apr1 = yieldPerSecondToAPR(RateModel.computeYieldPerSecond(newUtilization1)) * 100;
    return { apr0, apr1 };
  }, [cardInfo, boostFactor, marketInfo]);

  const { dailyInterest0, dailyInterest1 } = useMemo(() => {
    if (!apr0 || !apr1) {
      return { dailyInterest0: null, dailyInterest1: null };
    }
    const dailyInterest0 = (apr0 / 365) * (cardInfo.borrower?.liabilities.amount0 || 0);
    const dailyInterest1 = (apr1 / 365) * (cardInfo.borrower?.liabilities.amount1 || 0);
    return { dailyInterest0, dailyInterest1 };
  }, [apr0, apr1, cardInfo.borrower?.liabilities.amount0, cardInfo.borrower?.liabilities.amount1]);

  const nftTokenId = ethers.BigNumber.from(cardInfo?.nftTokenId || 0);
  const initializationData = useMemo(() => {
    if (!cardInfo) return undefined;
    const { position } = cardInfo;
    return ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'int24', 'int24', 'uint128', 'uint24'],
      [
        cardInfo.nftTokenId,
        position.lower,
        position.upper,
        position.liquidity.toString(10),
        (boostFactor * 10000).toFixed(0),
      ]
    ) as `0x${string}`;
  }, [cardInfo, boostFactor]);
  const enableHooks = cardInfo !== undefined;

  // Read who the manager is supposed to be
  const { data: necessaryManager } = useContractRead({
    address: ALOE_II_BOOST_NFT_ADDRESS[activeChain.id],
    abi: boostNftAbi,
    functionName: 'boostManager',
    chainId: activeChain.id,
    enabled: enableHooks,
  });

  // Read who is approved to manage this Uniswap NFT
  const {
    data: manager,
    refetch: refetchManager,
    isFetching: isFetchingManager,
  } = useContractRead({
    address: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[activeChain.id],
    abi: erc721ABI,
    functionName: 'getApproved',
    args: [nftTokenId],
    chainId: activeChain.id,
    enabled: enableHooks,
  });
  const managerIsCorrect = !!manager && manager === necessaryManager;
  const shouldWriteManager = !isFetchingManager && !!manager && !managerIsCorrect;
  const shouldMint = !isFetchingManager && !!initializationData && managerIsCorrect;

  // We need the Boost Manager to be approved, so if it's not, prepare to write
  const { config: configWriteManager } = usePrepareContractWrite({
    address: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[activeChain.id],
    abi: erc721ABI,
    functionName: 'approve',
    args: [necessaryManager ?? '0x', nftTokenId],
    chainId: activeChain.id,
    enabled: enableHooks && shouldWriteManager,
  });
  let gasLimit = configWriteManager.request?.gasLimit.mul(110).div(100);
  const {
    write: writeManager,
    data: writeManagerTxn,
    isLoading: isAskingUserToWriteManager,
  } = useContractWrite({
    ...configWriteManager,
    request: {
      ...configWriteManager.request,
      gasLimit,
    },
  });

  // Wait for the approval transaction to go through, then refetch manager
  const { isLoading: isWritingManager } = useWaitForTransaction({
    confirmations: 1,
    hash: writeManagerTxn?.hash,
    chainId: activeChain.id,
    onSuccess() {
      refetchManager();
    },
  });

  // Prepare for actual import/mint transaction
  const { config: configMint } = usePrepareContractWrite({
    address: ALOE_II_BOOST_NFT_ADDRESS[activeChain.id],
    abi: boostNftAbi,
    functionName: 'mint',
    args: [cardInfo?.uniswapPool ?? '0x', initializationData ?? '0x'],
    overrides: { value: ANTES[activeChain.id].recklessAdd(1).toBigNumber() },
    chainId: activeChain.id,
    enabled: enableHooks && shouldMint,
  });
  gasLimit = configMint.request?.gasLimit.mul(110).div(100);
  const { write: mint, isLoading: isAskingUserToMint } = useContractWrite({
    ...configMint,
    request: {
      ...configMint.request,
      gasLimit,
    },
    onSuccess(data) {
      setPendingTxn(data);
    },
  });

  let state: ImportState | undefined;
  if (isWritingManager) {
    state = ImportState.APPROVING;
  } else if (isAskingUserToWriteManager) {
    state = ImportState.ASKING_USER_TO_APPROVE;
  } else if (isAskingUserToMint) {
    state = ImportState.ASKING_USER_TO_MINT;
  } else if (shouldWriteManager && writeManager) {
    state = ImportState.READY_TO_APPROVE;
  } else if (shouldMint && mint) {
    state = ImportState.READY_TO_MINT;
  }

  const buttonState = getImportButtonState(state);

  return (
    <Container>
      <Text size='L'>Boost Factor</Text>
      <SliderContainer>
        <Display size='M'>{`${boostFactor}x`}</Display>
        <LeverageSlider
          type='range'
          list='boost-factor-labels'
          min={BOOST_MIN}
          max={BOOST_MAX}
          step={0.1}
          value={boostFactor}
          onChange={(e) => setBoostFactor(Number(e.target.value))}
        />
        <StyledDatalist id='boost-factor-labels'>
          {labels.map((label, i) => (
            <option key={i} value={i + 1} label={label}></option>
          ))}
        </StyledDatalist>
      </SliderContainer>
      <Text size='M' color={SECONDARY_COLOR} className='mt-4'>
        Estimated Fees
      </Text>
      <div className='flex justify-center gap-2 mt-2'>
        <div className='w-full'>
          <div className='flex flex-row justify-center items-end'>
            <Display size='S' color={SECONDARY_COLOR}>
              {formatTokenAmount(0, 2)}
            </Display>
            <Text size='S' color={SECONDARY_COLOR} className='ml-1'>
              {cardInfo.token0.symbol} / day
            </Text>
          </div>
        </div>
        <div className='w-full'>
          <div className='flex flex-row justify-center items-end'>
            <Display size='S' color={SECONDARY_COLOR}>
              {formatTokenAmount(0, 2)}
            </Display>
            <Text size='S' color={SECONDARY_COLOR} className='ml-1'>
              {cardInfo.token1.symbol} / day
            </Text>
          </div>
        </div>
      </div>
      <Text size='M' color={SECONDARY_COLOR} className='mt-4'>
        Estimated Interest
      </Text>
      <div className='flex justify-center gap-2 mt-2'>
        <div className='w-full'>
          <div className='flex flex-row justify-center items-end'>
            <Display size='S' color={SECONDARY_COLOR}>
              -{formatTokenAmount(dailyInterest0 ?? 0, 2)}
            </Display>
            <Text size='S' color={SECONDARY_COLOR} className='ml-1'>
              {cardInfo.token0.symbol} / day
            </Text>
          </div>
        </div>
        <div className='w-full'>
          <div className='flex flex-row justify-center items-end'>
            <Display size='S' color={SECONDARY_COLOR}>
              -{formatTokenAmount(dailyInterest1 ?? 0, 2)}
            </Display>
            <Text size='S' color={SECONDARY_COLOR} className='ml-1'>
              {cardInfo.token1.symbol} / day
            </Text>
          </div>
        </div>
      </div>
      <div className='mt-6 mx-6'>
        <FilledGradientButton
          size='M'
          onClick={() => {
            if (state === ImportState.READY_TO_APPROVE) {
              writeManager?.();
            } else if (state === ImportState.READY_TO_MINT) {
              mint?.();
            }
          }}
          disabled={buttonState.isDisabled}
          fillWidth={true}
        >
          {buttonState.label}
        </FilledGradientButton>
      </div>
    </Container>
  );
}
