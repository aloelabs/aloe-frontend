import { useContext, useEffect, useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { ethers } from 'ethers';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Display, Text } from 'shared/lib/components/common/Typography';
import {
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { GREY_700 } from 'shared/lib/data/constants/Colors';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { formatTokenAmount, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { Address } from 'viem';
import { useAccount, useSimulateContract, useWriteContract } from 'wagmi';

import { ChainContext } from '../../../App';
import { sqrtRatioToPrice, sqrtRatioToTick } from '../../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../../data/BorrowerNft';
import {
  getAmountsForLiquidity,
  tickToPrice,
  UniswapNFTPositionEntry,
  UniswapPosition,
  zip,
} from '../../../data/Uniswap';
import TokenPairIcons from '../../common/TokenPairIcons';
import { InRangeBadge, OutOfRangeBadge } from '../../common/UniswapPositionCard';

const ACCENT_COLOR = 'rgba(130, 160, 182, 1)';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  APPROVE_NFT_MANAGER,
  APPROVING,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(state: ConfirmButtonState): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.APPROVE_NFT_MANAGER:
      return { text: 'Approve', enabled: true };
    case ConfirmButtonState.APPROVING:
      return { text: 'Approving', enabled: false };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    default:
      return { text: 'Confirm', enabled: false };
  }
}

export const UniswapNFTPositionButtonWrapper = styled.button.attrs((props: { active: boolean }) => props)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 8px 16px;
  gap: 8px;
  border-radius: 8px;
  opacity: ${(props) => (props.active ? 1 : 0.25)};
  filter: ${(props) => (props.active ? 'none' : 'grayscale(100%)')};
  cursor: pointer;
  background-color: ${GREY_700};

  &:hover {
    filter: none;
    opacity: 1;
  }
`;

type WithdrawUniswapNFTButtonProps = {
  borrower: BorrowerNftBorrower;
  uniswapPosition: UniswapPosition;
  existingUniswapPositions: readonly UniswapPosition[];
  uniswapNFTPosition: UniswapNFTPositionEntry;
  userAddress: Address;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: WriteContractReturnType | null) => void;
};

function WithdrawUniswapNFTButton(props: WithdrawUniswapNFTButtonProps) {
  const {
    borrower,
    uniswapPosition,
    existingUniswapPositions,
    uniswapNFTPosition,
    userAddress,
    setIsOpen,
    setPendingTxn,
  } = props;
  const { activeChain } = useContext(ChainContext);

  const [isPending, setIsPending] = useState(false);

  const encodedData = useMemo(() => {
    return ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'int24', 'int24', 'int128', 'uint144'],
      [
        uniswapNFTPosition[0],
        uniswapNFTPosition[1].lower,
        uniswapNFTPosition[1].upper,
        uniswapPosition.liquidity.toString(10),
        zip(
          existingUniswapPositions.filter((position) => {
            return position.lower !== uniswapPosition.lower || position.upper !== uniswapPosition.upper;
          })
        ),
      ]
    ) as `0x${string}`;
  }, [uniswapNFTPosition, uniswapPosition, existingUniswapPositions]);

  const { data: contractWriteConfig } = useSimulateContract({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      userAddress,
      [borrower.index],
      [ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS[activeChain.id]],
      [encodedData as `0x${string}`],
      [0],
    ],
    chainId: activeChain.id,
  });
  const {
    writeContract,
    data: contractData,
    isSuccess: contractDidSucceed,
    isPending: contractIsLoading,
  } = useWriteContract();

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
      setIsOpen(false);
    } else if (!contractIsLoading && !contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractIsLoading, setPendingTxn, setIsOpen]);

  let confirmButtonState = ConfirmButtonState.READY;

  if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (contractWriteConfig && contractWriteConfig.request === undefined) {
    confirmButtonState = ConfirmButtonState.LOADING;
  }

  const confirmButton = getConfirmButton(confirmButtonState);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      disabled={!confirmButton.enabled}
      onClick={() => {
        if (confirmButtonState === ConfirmButtonState.READY && contractWriteConfig) {
          setIsPending(true);
          writeContract(contractWriteConfig.request);
        }
      }}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type WithdrawUniswapNFTModalProps = {
  borrower: BorrowerNftBorrower;
  uniswapPosition: UniswapPosition;
  existingUniswapPositions: readonly UniswapPosition[];
  uniswapNFTPosition: UniswapNFTPositionEntry;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export function WithdrawUniswapNFTModal(props: WithdrawUniswapNFTModalProps) {
  const { borrower, uniswapPosition, uniswapNFTPosition, isOpen, setIsOpen, setPendingTxn } = props;

  const { address: userAddress } = useAccount();

  const { sqrtPriceX96, token0, token1 } = borrower;

  const minPrice = uniswapPosition
    ? tickToPrice(uniswapPosition.lower, borrower.token0.decimals, borrower.token1.decimals, true)
    : 0;

  const maxPrice = uniswapPosition
    ? tickToPrice(uniswapPosition.upper, borrower.token0.decimals, borrower.token1.decimals, true)
    : 0;

  const [amount0, amount1] = uniswapPosition
    ? getAmountsForLiquidity(uniswapPosition, sqrtRatioToTick(sqrtPriceX96), token0.decimals, token1.decimals)
    : [0, 0];

  const token0PerToken1 = sqrtRatioToPrice(sqrtPriceX96, token0.decimals, token1.decimals);
  const amount0InTermsOfToken1 = amount0 * token0PerToken1;
  const totalValue = amount0InTermsOfToken1 + amount1;

  const amount0Percent = (amount0InTermsOfToken1 / totalValue) * 100;
  const amount1Percent = (amount1 / totalValue) * 100;

  const currentTick = sqrtRatioToTick(sqrtPriceX96);

  const isInRange = uniswapPosition && currentTick >= uniswapPosition.lower && currentTick <= uniswapPosition.upper;

  if (!userAddress) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Withdraw Uniswap NFT Position' maxWidth='340px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <div className='w-full max-w-[300px] m-auto mb-4'>
            <div className='flex flex-col items-center justify-center gap-4 '>
              <div className='w-full flex justify-between'>
                <TokenPairIcons
                  token0IconPath={token0.logoURI}
                  token1IconPath={token1.logoURI}
                  token0AltText={`${token0.symbol}'s icon`}
                  token1AltText={`${token1.symbol}'s icon`}
                />
                {isInRange ? <InRangeBadge /> : <OutOfRangeBadge />}
              </div>
              <div className='w-full flex justify-between'>
                <div className='text-left'>
                  <Display size='XS' color={ACCENT_COLOR}>
                    {roundPercentage(amount0Percent, 1)}%
                  </Display>
                  <Display size='S'>{formatTokenAmount(amount0, 5)}</Display>
                  <Text size='XS'>{borrower.token0.symbol}</Text>
                </div>
                <div className='text-right'>
                  <Display size='XS' color={ACCENT_COLOR}>
                    {roundPercentage(amount1Percent, 1)}%
                  </Display>
                  <Display size='S'>{formatTokenAmount(amount1, 5)}</Display>
                  <Text size='XS'>{borrower.token1.symbol}</Text>
                </div>
              </div>
              <div className='w-full flex justify-between'>
                <div className='text-left'>
                  <Text size='S' color={ACCENT_COLOR}>
                    Min Price
                  </Text>
                  <Display size='S'>{formatTokenAmount(minPrice, 5)}</Display>
                  <Text size='XS'>
                    {borrower.token1.symbol} per {borrower.token0.symbol}
                  </Text>
                </div>
                <div className='text-right'>
                  <Text size='S' color={ACCENT_COLOR}>
                    Max Price
                  </Text>
                  <Display size='S'>{formatTokenAmount(maxPrice, 5)}</Display>
                  <Text size='XS'>
                    {borrower.token1.symbol} per {borrower.token0.symbol}
                  </Text>
                </div>
              </div>
            </div>
          </div>
          <WithdrawUniswapNFTButton
            borrower={borrower}
            uniswapPosition={uniswapPosition}
            existingUniswapPositions={props.existingUniswapPositions}
            uniswapNFTPosition={uniswapNFTPosition}
            userAddress={userAddress}
            setIsOpen={setIsOpen}
            setPendingTxn={setPendingTxn}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By using our service, you agree to our{' '}
            <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
              Terms of Service
            </a>{' '}
            and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It
            is your duty to educate yourself and be aware of the risks.
          </Text>
        </div>
      </div>
    </Modal>
  );
}
