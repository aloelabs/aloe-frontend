import { useContext, useMemo } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber, ethers } from 'ethers';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import {
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_BORROWER_NFT_WITHDRAW_MANAGER_ADDRESS,
  ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { useAccount, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import { isHealthy } from '../../../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../../../data/BorrowerNft';
import { UniswapPosition, zip } from '../../../../data/Uniswap';
import HealthBar from '../../../common/HealthBar';

const GAS_ESTIMATE_WIGGLE_ROOM = 110;
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  CONTRACT_ERROR,
  WAITING_FOR_USER,
  PENDING,
  LOADING,
  DISABLED,
  READY,
}

function getConfirmButton(state: ConfirmButtonState): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.CONTRACT_ERROR:
      return { text: 'Error', enabled: false };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading...', enabled: false };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type ConfirmButtonProps = {
  borrower: BorrowerNftBorrower;
  positionToWithdraw: UniswapPosition;
  uniswapNftId: BigNumber;
  setIsOpen: (open: boolean) => void;
  setPendingTxnResult: (result: SendTransactionResult | null) => void;
};

function ConfirmButton(props: ConfirmButtonProps) {
  const { borrower, positionToWithdraw, uniswapNftId, setIsOpen, setPendingTxnResult } = props;
  const { activeChain } = useContext(ChainContext);

  const { address: userAddress } = useAccount();

  const encodedData = useMemo(() => {
    return ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'int24', 'int24', 'int128', 'uint208'],
      [
        uniswapNftId,
        positionToWithdraw.lower,
        positionToWithdraw.upper,
        positionToWithdraw.liquidity.toString(10),
        zip(
          borrower.assets.uniswapPositions.filter((position) => {
            return position.lower !== positionToWithdraw.lower || position.upper !== positionToWithdraw.upper;
          }),
          '0x83ee755b'
        ),
      ]
    ) as `0x${string}`;
  }, [borrower, positionToWithdraw, uniswapNftId]);

  const { config: withdrawConfig, error: withdrawError } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      userAddress ?? '0x',
      [borrower.index, borrower.index],
      [
        ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS[activeChain.id],
        ALOE_II_BORROWER_NFT_WITHDRAW_MANAGER_ADDRESS[activeChain.id],
      ],
      [encodedData, '0x'],
      [0, 0],
    ],
    enabled: Boolean(userAddress),
    chainId: activeChain.id,
  });
  const gasLimit = withdrawConfig.request?.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100);
  const { write: contractWrite, isLoading: isAskingUserToConfirm } = useContractWrite({
    ...withdrawConfig,
    request: {
      ...withdrawConfig.request,
      gasLimit,
    },
    onSuccess(data) {
      setIsOpen(false);
      setPendingTxnResult(data);
    },
  });

  let confirmButtonState = ConfirmButtonState.READY;
  if (withdrawError !== null) {
    confirmButtonState = ConfirmButtonState.CONTRACT_ERROR;
  } else if (contractWrite === undefined || !withdrawConfig.request) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (isAskingUserToConfirm) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_USER;
  }

  const confirmButton = getConfirmButton(confirmButtonState);

  return (
    <FilledStylizedButton size='M' fillWidth={true} disabled={!confirmButton.enabled} onClick={contractWrite}>
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type RemoveCollateralModalContentProps = {
  borrower: BorrowerNftBorrower;
  positionToWithdraw: UniswapPosition;
  uniswapNftId: BigNumber;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxnResult: (result: SendTransactionResult | null) => void;
};

export default function ToUniswapNFTModalContent(props: RemoveCollateralModalContentProps) {
  const { borrower, positionToWithdraw, uniswapNftId, setIsOpen, setPendingTxnResult } = props;

  const { health: newHealth } = isHealthy(
    borrower.assets,
    borrower.liabilities,
    borrower.sqrtPriceX96,
    borrower.iv,
    borrower.nSigma,
    borrower.token0.decimals,
    borrower.token1.decimals
  );

  const canExecute = newHealth > 1.0;

  // TODO: could provide links (in summary) to both the BorrowerNFT and UniswapNFT on OpenSea
  return (
    <>
      <div className='flex flex-col gap-1 w-full'>
        <HealthBar health={newHealth} />
        <Text size='M' weight='bold' className='mt-4'>
          Summary
        </Text>
        {canExecute ? (
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You have an {borrower.token0.symbol}/{borrower.token1.symbol} Uniswap Position in the range{' '}
            {positionToWithdraw.lower}&nbsp;⇔&nbsp;{positionToWithdraw.upper}. You're moving it from an Aloe Borrower
            NFT back to a plain Uniswap NFT (#{uniswapNftId.toString()}). It will no longer act as collateral.
          </Text>
        ) : (
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            This Uniswap NFT is the only thing keeping your position healthy. Before you can withdraw, you must repay
            some (or all) borrows.
          </Text>
        )}
      </div>
      {canExecute && (
        <div className='flex flex-col gap-4 w-full'>
          <ConfirmButton
            borrower={borrower}
            positionToWithdraw={positionToWithdraw}
            uniswapNftId={uniswapNftId}
            setIsOpen={setIsOpen}
            setPendingTxnResult={setPendingTxnResult}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full'>
            By withdrawing, you agree to our{' '}
            <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
              Terms of Service
            </a>{' '}
            and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It
            is your duty to educate yourself and be aware of the risks.
          </Text>
        </div>
      )}
    </>
  );
}
