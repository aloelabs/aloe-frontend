import { useContext, useEffect, useMemo, useState } from 'react';

import Big from 'big.js';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { useNavigate } from 'react-router-dom';
import { boostNftAbi } from 'shared/lib/abis/BoostNFT';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Display, Text } from 'shared/lib/components/common/Typography';
import {
  ALOE_II_BOOST_MANAGER_ADDRESS,
  ALOE_II_BOOST_NFT_ADDRESS,
  ANTES,
  UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { FeeTier } from 'shared/lib/data/FeeTier';
import styled from 'styled-components';
import { erc721ABI, useContractRead, useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';

import { ChainContext } from '../../App';
import { BoostCardInfo } from '../../data/Uniboost';
import BoostCard from './BoostCard';

const BOOST_MIN = 1;
const BOOST_MAX = 5;
const BOOST_DEFAULT = BOOST_MIN;
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

const Container = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 20px;
`;

const ImportContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 300px;
  text-align: center;
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
    top: -14px;
    width: 2px;
    height: 4px;
    background-color: #ffffff;
  }
`;

const LeverageSlider = styled.input`
  appearance: none;
  -webkit-appearance: none;
  height: 6px;
  background: #ffffff;
  border-radius: 0px;
  background-repeat: no-repeat;
  width: 200px;
  margin: 0 auto;

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

enum ImportModalState {
  FETCHING_DATA,
  READY_TO_APPROVE,
  ASKING_USER_TO_APPROVE,
  WAITING_FOR_TRANSACTION,
  READY_TO_MINT,
  ASKING_USER_TO_MINT,
}

function getButtonState(state?: ImportModalState) {
  switch (state) {
    case ImportModalState.FETCHING_DATA:
      return {
        disabled: true,
        label: 'Loading...',
      };
    case ImportModalState.READY_TO_APPROVE:
      return {
        disabled: false,
        label: 'Approve',
      };
    case ImportModalState.ASKING_USER_TO_APPROVE:
      return {
        disabled: true,
        label: 'Approve',
      };
    case ImportModalState.WAITING_FOR_TRANSACTION:
      return {
        disabled: true,
        label: 'Pending',
      };
    case ImportModalState.READY_TO_MINT:
      return {
        disabled: false,
        label: 'Confirm',
      };
    case ImportModalState.ASKING_USER_TO_MINT:
      return {
        disabled: true,
        label: 'Confirm',
      };
    default:
      return {
        disabled: true,
        label: 'Loading...',
      };
  }
}

export type ImportModalProps = {
  cardInfo?: BoostCardInfo;
  uniqueId: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export default function ImportModal(props: ImportModalProps) {
  const { cardInfo, uniqueId, isOpen, setIsOpen } = props;
  const { activeChain } = useContext(ChainContext);
  const navigate = useNavigate();

  const [boostFactor, setBoostFactor] = useState(BOOST_DEFAULT);

  useEffect(() => {
    if (isOpen) {
      setBoostFactor(BOOST_DEFAULT);
    }
  }, [isOpen]);

  const nftTokenId = ethers.BigNumber.from(cardInfo?.nftTokenId || 0);
  const initializationData = useMemo(() => {
    if (!cardInfo) return undefined;
    const { position } = cardInfo;
    return ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'int24', 'int24', 'uint128', 'uint24'],
      [cardInfo.nftTokenId, position.lower, position.upper, position.liquidity.toString(10), boostFactor * 10000]
    ) as `0x${string}`;
  }, [cardInfo, boostFactor]);
  const enableHooks = isOpen && cardInfo !== undefined;

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
  const shouldWriteManager =
    !isFetchingManager && !!manager && manager !== ALOE_II_BOOST_MANAGER_ADDRESS[activeChain.id];
  const shouldMint =
    !isFetchingManager && !!initializationData && manager === ALOE_II_BOOST_MANAGER_ADDRESS[activeChain.id];

  // We need the Boost Manager to be approved, so if it's not, prepare to write
  const { config: configWriteManager } = usePrepareContractWrite({
    address: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[activeChain.id],
    abi: erc721ABI,
    functionName: 'approve',
    args: [ALOE_II_BOOST_MANAGER_ADDRESS[activeChain.id], nftTokenId],
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
    onSuccess(data) {
      console.debug('Approve transaction successful!', data);
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
  const {
    write: mint,
    data: mintTxn,
    isLoading: isAskingUserToMint,
  } = useContractWrite({
    ...configMint,
    request: {
      ...configMint.request,
      gasLimit,
    },
  });

  // Wait for the mint transaction to go through
  const { isLoading: isMinting } = useWaitForTransaction({
    confirmations: 1,
    hash: mintTxn?.hash,
    chainId: activeChain.id,
    onSuccess() {
      navigate(0);
    },
  });

  let state: ImportModalState | undefined;
  if (isFetchingManager) {
    state = ImportModalState.FETCHING_DATA;
  } else if (isWritingManager || isMinting) {
    state = ImportModalState.WAITING_FOR_TRANSACTION;
  } else if (isAskingUserToWriteManager) {
    state = ImportModalState.ASKING_USER_TO_APPROVE;
  } else if (isAskingUserToMint) {
    state = ImportModalState.ASKING_USER_TO_MINT;
  } else if (shouldWriteManager && writeManager) {
    state = ImportModalState.READY_TO_APPROVE;
  } else if (shouldMint && mint) {
    state = ImportModalState.READY_TO_MINT;
  }

  const buttonState = getButtonState(state);

  // Generate labels for input range (slider)
  const labels: string[] = [];
  for (let i = BOOST_MIN; i <= BOOST_MAX; i += 1) {
    if (i % 2 !== 0) {
      labels.push(`${i.toFixed(0)}x`);
    } else {
      labels.push('');
    }
  }

  const updatedCardInfo: BoostCardInfo | undefined = useMemo(() => {
    if (!cardInfo) return undefined;
    const { position } = cardInfo;
    const updatedLiquidity = JSBI.multiply(position.liquidity, JSBI.BigInt(boostFactor));
    return new BoostCardInfo(
      cardInfo.cardType,
      cardInfo.nftTokenId,
      cardInfo.uniswapPool,
      cardInfo.currentTick,
      cardInfo.token0,
      cardInfo.token1,
      cardInfo.color0,
      cardInfo.color1,
      {
        ...cardInfo.position,
        liquidity: updatedLiquidity,
      },
      cardInfo.feesEarned,
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
        sqrtPriceX96: new Big(0),
        health: 0,
        lender0: '0x',
        lender1: '0x',
        iv: 0,
      }
    );
  }, [cardInfo, boostFactor]);

  return (
    <Modal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title={'Import Uniswap Position'}
      maxWidth='660px'
      backgroundColor='rgba(43, 64, 80, 0.1)'
      backdropFilter='blur(40px)'
    >
      {updatedCardInfo && (
        <Container>
          <BoostCard info={updatedCardInfo} isDisplayOnly={true} uniqueId={uniqueId} />
          <ImportContainer>
            <Text size='L'>Boost Factor</Text>
            <div>
              <Display size='M'>{`${boostFactor}x`}</Display>
              <LeverageSlider
                type='range'
                list='boost-factor-labels'
                min={BOOST_MIN}
                max={BOOST_MAX}
                step={1}
                value={boostFactor}
                onChange={(e) => setBoostFactor(parseInt(e.target.value) || 0)}
              />
              <StyledDatalist id='boost-factor-labels'>
                {labels.map((label, i) => (
                  <option key={i} value={i + 1} label={label}></option>
                ))}
              </StyledDatalist>
            </div>
            <div className='flex flex-col gap-1 w-full mt-auto'>
              <Text size='M' weight='bold' className='w-full text-start'>
                Summary
              </Text>
              <Text size='XS' color={SECONDARY_COLOR} className='w-full text-start overflow-hidden text-ellipsis'>
                You're moving your liquidity from a Uniswap NFT to an Aloe NFT and are applying a{' '}
                <strong>{boostFactor}x boost</strong>. As a result, you will earn swap fees {boostFactor}x faster, but
                you will also be paying intest to Aloe lenders and risk liquidation. Liquidation thresholds are shown in
                the graph to the left.
              </Text>
            </div>
            <div className='w-full mt-8'>
              <FilledStylizedButton
                size='M'
                fillWidth={true}
                disabled={buttonState.disabled}
                onClick={() => {
                  if (state === ImportModalState.READY_TO_APPROVE) {
                    writeManager?.();
                  } else if (state === ImportModalState.READY_TO_MINT) {
                    mint?.();
                  }
                }}
              >
                {buttonState.label}
              </FilledStylizedButton>
              <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
                By depositing, you agree to our{' '}
                <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
                  Terms of Service
                </a>{' '}
                and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur.
                It is your duty to educate yourself and be aware of the risks.
              </Text>
            </div>
          </ImportContainer>
        </Container>
      )}
    </Modal>
  );
}
