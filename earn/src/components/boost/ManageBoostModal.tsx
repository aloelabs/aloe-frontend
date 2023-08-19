import { useContext, useMemo } from 'react';

import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { boostNftAbi } from 'shared/lib/abis/BoostNFT';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BOOST_NFT_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN } from 'shared/lib/data/GoodNumber';
import styled from 'styled-components';
import { useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';

import { ChainContext } from '../../App';
import { MarginAccount } from '../../data/MarginAccount';
import { BoostCardInfo } from '../../data/Uniboost';
import BoostCard from './BoostCard';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

const Container = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 20px;
`;

const EditLeverageContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 300px;
  text-align: center;
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

enum ManageModalState {
  WAITING_FOR_TRANSACTION,
  READY_TO_BURN,
  ASKING_USER_TO_BURN,
}

function getButtonState(state?: ManageModalState) {
  switch (state) {
    case ManageModalState.WAITING_FOR_TRANSACTION:
      return { isDisabled: true, label: 'Pending' };
    case ManageModalState.READY_TO_BURN:
      return { isDisabled: false, label: 'Burn' };
    case ManageModalState.ASKING_USER_TO_BURN:
      return { isDisabled: true, label: 'Burn' };
    default:
      return { isDisabled: true, label: 'Loading...' };
  }
}

export type ManageBoostModalProps = {
  cardInfo?: BoostCardInfo;
  uniqueId: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export default function ManageBoostModal(props: ManageBoostModalProps) {
  const { cardInfo, uniqueId, isOpen, setIsOpen } = props;
  const { activeChain } = useContext(ChainContext);

  const navigate = useNavigate();

  const nftTokenId = ethers.BigNumber.from(cardInfo?.nftTokenId || 0);

  const modifyData = useMemo(() => {
    if (!cardInfo) return undefined;
    const { maxSpend, zeroForOne } = computeData(cardInfo.borrower || undefined);
    const { position } = cardInfo;
    return ethers.utils.defaultAbiCoder.encode(
      ['int24', 'int24', 'uint128', 'uint128', 'bool'],
      [position.lower, position.upper, position.liquidity.toString(10), maxSpend?.toBigNumber(), zeroForOne]
    ) as `0x${string}`;
  }, [cardInfo]);

  const enableHooks = isOpen && cardInfo !== undefined;

  const { config: configBurn } = usePrepareContractWrite({
    address: ALOE_II_BOOST_NFT_ADDRESS[activeChain.id],
    abi: boostNftAbi,
    functionName: 'modify',
    args: [nftTokenId, 2, modifyData ?? '0x', [true, true]],
    chainId: activeChain.id,
    enabled: enableHooks,
  });
  let gasLimit = configBurn.request?.gasLimit.mul(110).div(100);
  const {
    write: burn,
    data: burnTxn,
    isLoading: isAskingUserToBurn,
  } = useContractWrite({
    ...configBurn,
    request: {
      ...configBurn.request,
      gasLimit,
    },
  });

  const { isLoading: isBurning } = useWaitForTransaction({
    confirmations: 1,
    hash: burnTxn?.hash,
    chainId: activeChain.id,
    onSuccess() {
      navigate(0);
    },
  });

  let state: ManageModalState | undefined;
  if (isAskingUserToBurn) {
    state = ManageModalState.ASKING_USER_TO_BURN;
  } else if (isBurning) {
    state = ManageModalState.WAITING_FOR_TRANSACTION;
  } else {
    state = ManageModalState.READY_TO_BURN;
  }

  const buttonState = getButtonState(state);

  return (
    <Modal
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title={'Manage'}
      maxWidth='660px'
      backgroundColor='rgba(43, 64, 80, 0.1)'
      backdropFilter='blur(40px)'
    >
      {cardInfo && (
        <Container>
          <BoostCard info={cardInfo} isDisplayOnly={true} uniqueId={uniqueId} />
          <EditLeverageContainer>
            <Text size='M' weight='bold'>
              Edit Leverage
            </Text>
            <div className='flex flex-col gap-1 w-full mt-auto'>
              <Text size='M' weight='bold' className='w-full text-start'>
                Summary
              </Text>
              <Text size='XS' color={SECONDARY_COLOR} className='w-full text-start overflow-hidden text-ellipsis'>
                TODO
              </Text>
            </div>
            <div className='w-full mt-8'>
              <FilledStylizedButton
                size='M'
                fillWidth={true}
                disabled={buttonState.isDisabled}
                onClick={() => {
                  if (state === ManageModalState.READY_TO_BURN) {
                    burn?.();
                  }
                }}
              >
                {buttonState.label}
              </FilledStylizedButton>
              <Text size='XS' color={TERTIARY_COLOR} className='w-full text-start mt-2'>
                By withdrawing, you agree to our{' '}
                <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
                  Terms of Service
                </a>{' '}
                and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur.
                It is your duty to educate yourself and be aware of the risks.
              </Text>
            </div>
          </EditLeverageContainer>
        </Container>
      )}
    </Modal>
  );
}
