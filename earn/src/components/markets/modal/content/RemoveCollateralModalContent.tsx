import { useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { ethers } from 'ethers';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { MODAL_BLACK_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import { isHealthy, maxWithdraws } from 'shared/lib/data/BalanceSheet';
import { Assets } from 'shared/lib/data/Borrower';
import {
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_BORROWER_NFT_MULTI_MANAGER_ADDRESS,
  ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import useChain from 'shared/lib/hooks/UseChain';
import { Address, encodeFunctionData, Hex } from 'viem';
import { useAccount, useSimulateContract, useWriteContract } from 'wagmi';

import { BorrowerNftBorrower } from '../../../../hooks/useDeprecatedMarginAccountShim';
import HealthBar from '../../../common/HealthBar';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  REDEEM_TOO_MUCH,
  WAITING_FOR_USER,
  LOADING,
  DISABLED,
  READY,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.REDEEM_TOO_MUCH:
      return {
        text: `Insufficient ${token.symbol}`,
        enabled: false,
      };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading...', enabled: false };
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
  withdrawAmount: GN;
  maxWithdrawAmount: GN;
  borrower: BorrowerNftBorrower;
  token: Token;
  isWithdrawingToken0: boolean;
  shouldWithdrawAnte: boolean;
  accountAddress: Address;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

function ConfirmButton(props: ConfirmButtonProps) {
  const {
    withdrawAmount,
    maxWithdrawAmount,
    borrower,
    token,
    isWithdrawingToken0,
    shouldWithdrawAnte,
    accountAddress,
    setIsOpen,
    setPendingTxn,
  } = props;
  const activeChain = useChain();

  const isRedeemingTooMuch = withdrawAmount.gt(maxWithdrawAmount);

  const encodedWithdrawCall = useMemo(() => {
    if (!accountAddress) return null;
    const amount0 = isWithdrawingToken0 ? withdrawAmount : GN.zero(borrower.token0.decimals);
    const amount1 = isWithdrawingToken0 ? GN.zero(borrower.token1.decimals) : withdrawAmount;

    return encodeFunctionData({
      abi: borrowerAbi,
      functionName: 'transfer',
      args: [amount0.toBigInt(), amount1.toBigInt(), accountAddress],
    });
  }, [withdrawAmount, borrower.token0.decimals, borrower.token1.decimals, isWithdrawingToken0, accountAddress]);

  const encodedWithdrawAnteCall = useMemo(() => {
    if (!accountAddress || !borrower.ethBalance) return null;

    return encodeFunctionData({
      abi: borrowerAbi,
      functionName: 'transferEth',
      args: [borrower.ethBalance.toBigInt(), accountAddress],
    });
  }, [accountAddress, borrower.ethBalance]);

  const combinedEncodingsForMultiManager = useMemo(() => {
    if (!encodedWithdrawCall || !encodedWithdrawAnteCall) return null;
    return ethers.utils.defaultAbiCoder.encode(['bytes[]'], [[encodedWithdrawCall, encodedWithdrawAnteCall]]) as Hex;
  }, [encodedWithdrawCall, encodedWithdrawAnteCall]);

  const { data: withdrawConfig, isLoading: isCheckingIfAbleToWithdraw } = useSimulateContract({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      accountAddress ?? '0x',
      [borrower.index],
      [
        shouldWithdrawAnte
          ? ALOE_II_BORROWER_NFT_MULTI_MANAGER_ADDRESS[activeChain.id]
          : ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS[activeChain.id],
      ],
      [(shouldWithdrawAnte ? combinedEncodingsForMultiManager : encodedWithdrawCall) ?? '0x'],
      [0],
    ],
    chainId: activeChain.id,
    query: {
      enabled:
        accountAddress &&
        encodedWithdrawCall != null &&
        !isRedeemingTooMuch &&
        !(shouldWithdrawAnte && !encodedWithdrawAnteCall),
    },
  });
  const { writeContractAsync: withdraw, isPending: isAskingUserToConfirm } = useWriteContract();

  let confirmButtonState: ConfirmButtonState = ConfirmButtonState.READY;

  if (isCheckingIfAbleToWithdraw) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (withdrawAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else if (isRedeemingTooMuch) {
    confirmButtonState = ConfirmButtonState.REDEEM_TOO_MUCH;
  } else if (isAskingUserToConfirm) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_USER;
  } else if (!withdrawConfig) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      color={MODAL_BLACK_TEXT_COLOR}
      onClick={() =>
        withdraw(withdrawConfig!.request)
          .then((hash) => {
            setIsOpen(false);
            setPendingTxn(hash);
          })
          .catch((e) => console.error(e))
      }
      disabled={!confirmButton.enabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type RemoveCollateralModalContentProps = {
  borrower: BorrowerNftBorrower;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxnResult: (result: WriteContractReturnType | null) => void;
};

export default function RemoveCollateralModalContent(props: RemoveCollateralModalContentProps) {
  const { borrower, setIsOpen, setPendingTxnResult } = props;

  const [withdrawAmountStr, setWithdrawAmountStr] = useState('');

  const { address: accountAddress } = useAccount();

  // TODO: This logic needs to change once we support more complex borrowing
  const isWithdrawingToken0 = borrower.assets.amount0.isGtZero();

  // TODO: This logic needs to change once we support more complex borrowing
  const collateralToken = isWithdrawingToken0 ? borrower.token0 : borrower.token1;

  // TODO: This assumes that the borrowing token is always the opposite of the collateral token
  // and that only one token is borrowed and one token is collateralized
  const existingCollateral = isWithdrawingToken0 ? borrower.assets.amount0 : borrower.assets.amount1;
  const withdrawAmount = GN.fromDecimalString(withdrawAmountStr || '0', collateralToken.decimals);
  const newCollateralAmount = existingCollateral.sub(withdrawAmount);

  const numericMaxWithdrawAmount = maxWithdraws(
    borrower.assets,
    borrower.liabilities,
    borrower.sqrtPriceX96,
    borrower.iv,
    borrower.nSigma,
    borrower.token0.decimals,
    borrower.token1.decimals
  )[isWithdrawingToken0 ? 0 : 1];

  const maxWithdrawAmount = GN.min(
    existingCollateral,
    GN.fromNumber(numericMaxWithdrawAmount, collateralToken.decimals)
  );

  const max = maxWithdrawAmount;
  const maxStr = max.toString(GNFormat.DECIMAL);

  const newAssets = new Assets(
    isWithdrawingToken0 ? newCollateralAmount : borrower.assets.amount0,
    isWithdrawingToken0 ? borrower.assets.amount1 : newCollateralAmount,
    borrower.assets.uniswapPositions
  );

  const { health: newHealth } = isHealthy(
    newAssets,
    borrower.liabilities,
    borrower.sqrtPriceX96,
    borrower.iv,
    borrower.nSigma,
    borrower.token0.decimals,
    borrower.token1.decimals
  );

  const shouldWithdrawAnte = newAssets.amount0.isZero() && newAssets.amount1.isZero();

  return (
    <>
      <div className='flex justify-between items-center mb-4'>
        <TokenAmountInput
          token={collateralToken}
          onChange={(updatedAmount: string) => {
            setWithdrawAmountStr(updatedAmount);
          }}
          value={withdrawAmountStr}
          max={maxStr}
          maxed={withdrawAmountStr === maxStr}
        />
      </div>
      <div className='flex flex-col gap-1 w-full'>
        <Text size='M' weight='bold'>
          Summary
        </Text>
        <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
          You're removing{' '}
          <strong>
            {withdrawAmountStr || '0.00'} {collateralToken.symbol}
          </strong>{' '}
          collateral from this{' '}
          <strong>
            {borrower.token0.symbol}/{borrower.token1.symbol}
          </strong>{' '}
          smart wallet. Your total collateral for this token in this smart wallet will be{' '}
          <strong>
            {newCollateralAmount.toString(GNFormat.DECIMAL)} {collateralToken.symbol}
          </strong>
          .
        </Text>
        <div className='mt-2'>
          <HealthBar health={newHealth} />
        </div>
      </div>
      <div className='w-full ml-auto mt-8'>
        <ConfirmButton
          withdrawAmount={withdrawAmount}
          maxWithdrawAmount={maxWithdrawAmount}
          borrower={borrower}
          token={collateralToken}
          isWithdrawingToken0={isWithdrawingToken0}
          shouldWithdrawAnte={shouldWithdrawAnte}
          accountAddress={accountAddress || '0x'}
          setIsOpen={setIsOpen}
          setPendingTxn={setPendingTxnResult}
        />
      </div>
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By withdrawing, you agree to our{' '}
        <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </>
  );
}
