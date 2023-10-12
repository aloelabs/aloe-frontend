import { Dispatch, useContext, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { boostNftAbi } from 'shared/lib/abis/BoostNFT';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BOOST_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { Q32 } from 'shared/lib/data/constants/Values';
import { GN } from 'shared/lib/data/GoodNumber';
import { useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../App';
import { MarginAccount } from '../../data/MarginAccount';
import { BoostCardInfo } from '../../data/Uniboost';
import MaxSlippageInput from '../common/MaxSlippageInput';

const SECONDARY_COLOR = '#CCDFED';
const SLIPPAGE_TOOLTIP_TEXT = `Slippage tolerance is the maximum price difference you are willing to
 accept between the estimated price and the execution price.`;

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

export type BurnBoostModalProps = {
  isOpen: boolean;
  cardInfo: BoostCardInfo;
  oracleSeed?: number;
  nftTokenId?: string;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: Dispatch<SendTransactionResult | null>;
};

export default function BurnBoostModal(props: BurnBoostModalProps) {
  const { isOpen, cardInfo, oracleSeed, nftTokenId, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [slippage, setSlippage] = useState('0.10');

  const modifyData = useMemo(() => {
    const slippagePercentage = parseFloat(slippage) / 100;
    const { maxSpend, zeroForOne } = computeData(
      cardInfo?.borrower || undefined,
      isNaN(slippagePercentage) ? undefined : slippagePercentage
    );
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
  }, [cardInfo?.borrower, cardInfo?.position.liquidity, cardInfo?.position.lower, cardInfo?.position.upper, slippage]);

  const { config: configBurn, isLoading: isCheckingIfAbleToBurn } = usePrepareContractWrite({
    address: ALOE_II_BOOST_NFT_ADDRESS[activeChain.id],
    abi: boostNftAbi,
    functionName: 'modify',
    args: [ethers.BigNumber.from(nftTokenId || 0), 2, modifyData, oracleSeed ?? Q32],
    chainId: activeChain.id,
    enabled:
      nftTokenId !== undefined &&
      cardInfo != null &&
      !JSBI.equal(cardInfo?.position.liquidity, JSBI.BigInt(0)) &&
      Boolean(oracleSeed),
  });
  let gasLimit = configBurn.request?.gasLimit.mul(110).div(100);
  const { write: burn, isLoading: burnIsLoading } = useContractWrite({
    ...configBurn,
    request: {
      ...configBurn.request,
      gasLimit,
    },
    onSuccess: (data: SendTransactionResult) => {
      setIsOpen(false);
      setPendingTxn(data);
    },
  });

  let confirmButtonState = ConfirmButtonState.READY;
  if (burnIsLoading) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_USER;
  } else if (isCheckingIfAbleToBurn) {
    confirmButtonState = ConfirmButtonState.LOADING;
  }

  const confirmButton = getConfirmButton(confirmButtonState);

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Burn Boosted Position'>
      <div className='w-full flex flex-col items-center justify-center gap-4'>
        <div className='w-full flex flex-col gap-1'>
          <MaxSlippageInput
            tooltipContent={SLIPPAGE_TOOLTIP_TEXT}
            updateMaxSlippage={(value: string) => {
              setSlippage(value);
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
            in return. You have selected a slippage tolerance of <strong>{slippage}%</strong>.
          </Text>
        </div>
        <FilledGradientButton size='M' fillWidth={true} disabled={!confirmButton.enabled} onClick={burn}>
          {confirmButton.text}
        </FilledGradientButton>
      </div>
    </Modal>
  );
}
