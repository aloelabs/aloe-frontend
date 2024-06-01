import { Dispatch, useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { sqrtRatioToTick } from 'shared/lib/data/BalanceSheet';
import { ALOE_II_BOOST_MANAGER_ADDRESS, ALOE_II_BORROWER_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN } from 'shared/lib/data/GoodNumber';
import useChain from 'shared/lib/hooks/UseChain';
import { Hex } from 'viem';
import { useAccount, useSimulateContract, useWriteContract } from 'wagmi';

import { MarginAccount } from '../../data/MarginAccount';
import { BoostCardInfo } from '../../data/Uniboost';
import MaxSlippageInput from '../common/MaxSlippageInput';

const SECONDARY_COLOR = '#CCDFED';

enum ConfirmButtonState {
  WAITING_FOR_USER,
  READY,
  LOADING,
}

function getConfirmButton(state: ConfirmButtonState): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading', enabled: false };
    default:
      return { text: 'Confirm', enabled: false };
  }
}

function calculateShortfall(borrower: MarginAccount): { shortfall0: GN; shortfall1: GN } {
  if (!borrower) return { shortfall0: GN.zero(0), shortfall1: GN.zero(0) };
  const { assets, liabilities } = borrower;
  const [assets0, assets1] = assets.amountsAt(sqrtRatioToTick(borrower.sqrtPriceX96));
  return {
    shortfall0: GN.fromNumber(liabilities.amount0 - assets0, borrower.token0.decimals),
    shortfall1: GN.fromNumber(liabilities.amount1 - assets1, borrower.token1.decimals),
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

export type BurnBoostModalProps = {
  isOpen: boolean;
  cardInfo: BoostCardInfo;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: Dispatch<WriteContractReturnType | null>;
};

export default function BurnBoostModal(props: BurnBoostModalProps) {
  const { isOpen, cardInfo, setIsOpen, setPendingTxn } = props;
  const activeChain = useChain();
  const [slippagePercentage, setSlippagePercentage] = useState('0.10');
  const { address: userAddress } = useAccount();

  const modifyData = useMemo(() => {
    const slippage = parseFloat(slippagePercentage) / 100;
    const { maxSpend, zeroForOne } = computeData(
      cardInfo.borrower || undefined,
      isNaN(slippage) ? undefined : slippage
    );
    const inner = ethers.utils.defaultAbiCoder.encode(
      ['uint128', 'bool'],
      [maxSpend.toBigNumber(), zeroForOne]
    ) as Hex;
    const actionId = 2;
    return ethers.utils.defaultAbiCoder.encode(['uint8', 'bytes'], [actionId, inner]) as Hex;
  }, [cardInfo.borrower, slippagePercentage]);

  const { data: configBurn, isLoading: isCheckingIfAbleToBurn } = useSimulateContract({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [cardInfo.owner, [cardInfo.nftTokenPtr!], [ALOE_II_BOOST_MANAGER_ADDRESS[activeChain.id]], [modifyData], [0]],
    chainId: activeChain.id,
    query: { enabled: userAddress && !JSBI.equal(cardInfo.position.liquidity, JSBI.BigInt(0)) },
  });
  const { writeContractAsync: burn, isPending: burnIsLoading } = useWriteContract();

  let confirmButtonState = ConfirmButtonState.READY;
  if (burnIsLoading) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_USER;
  } else if (isCheckingIfAbleToBurn || !configBurn) {
    confirmButtonState = ConfirmButtonState.LOADING;
  }

  const confirmButton = getConfirmButton(confirmButtonState);

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Burn Boosted Position'>
      <div className='w-full flex flex-col items-center justify-center gap-4'>
        <div className='w-full flex flex-col gap-1 mt-6'>
          <MaxSlippageInput
            updateMaxSlippage={(value: string) => {
              setSlippagePercentage(value);
            }}
            disabled={burnIsLoading}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You are burning your boosted position. You will receive{' '}
            <strong>
              {cardInfo.amount0()} {cardInfo.token0.symbol}
            </strong>{' '}
            and{' '}
            <strong>
              {cardInfo.amount1()} {cardInfo.token1.symbol}
            </strong>{' '}
            in return. You have selected a slippage tolerance of <strong>{slippagePercentage}%</strong>.
          </Text>
        </div>
        <FilledGradientButton
          size='M'
          fillWidth={true}
          disabled={!confirmButton.enabled}
          onClick={() => {
            burn(configBurn!.request)
              .then((hash) => {
                setIsOpen(false);
                setPendingTxn(hash);
              })
              .catch((e) => console.error(e));
          }}
        >
          {confirmButton.text}
        </FilledGradientButton>
      </div>
    </Modal>
  );
}
