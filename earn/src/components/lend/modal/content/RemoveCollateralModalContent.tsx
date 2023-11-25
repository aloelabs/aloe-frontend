import { useContext, useMemo, useState } from 'react';

import { Address, SendTransactionResult } from '@wagmi/core';
import { ethers } from 'ethers';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import {
  DashedDivider,
  LABEL_TEXT_COLOR,
  MODAL_BLACK_TEXT_COLOR,
  VALUE_TEXT_COLOR,
} from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import {
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { useAccount, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import { maxWithdraws } from '../../../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../../../data/BorrowerNft';
import { useBalanceOfUnderlying } from '../../../../data/hooks/UseUnderlyingBalanceOf';

const GAS_ESTIMATE_WIGGLE_ROOM = 110;
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  REDEEM_TOO_MUCH,
  PENDING,
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
      return { text: 'Confirm', enabled: false };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', enabled: false };
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
  accountAddress: Address;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function ConfirmButton(props: ConfirmButtonProps) {
  const { withdrawAmount, maxWithdrawAmount, borrower, token, isWithdrawingToken0, accountAddress, setPendingTxn } =
    props;
  const { activeChain } = useContext(ChainContext);

  const isRedeemingTooMuch = withdrawAmount.gt(maxWithdrawAmount);

  const encodedWithdrawCall = useMemo(() => {
    if (!accountAddress) return null;
    const borrowerInterface = new ethers.utils.Interface(borrowerAbi);
    const amount0 = isWithdrawingToken0 ? withdrawAmount : GN.zero(borrower.token0.decimals);
    const amount1 = isWithdrawingToken0 ? GN.zero(borrower.token1.decimals) : withdrawAmount;

    return borrowerInterface.encodeFunctionData('transfer', [
      amount0.toBigNumber(),
      amount1.toBigNumber(),
      accountAddress,
    ]) as `0x${string}`;
  }, [withdrawAmount, borrower.token0.decimals, borrower.token1.decimals, isWithdrawingToken0, accountAddress]);

  const { config: withdrawConfig, isLoading: isCheckingIfAbleToWithdraw } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      accountAddress ?? '0x',
      [borrower.index],
      [ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS[activeChain.id]],
      [encodedWithdrawCall ?? '0x'],
      [0],
    ],
    chainId: activeChain.id,
    enabled: accountAddress && encodedWithdrawCall != null && !isRedeemingTooMuch,
  });
  const gasLimit = withdrawConfig.request?.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100);
  const { write: withdraw, isLoading: isAskingUserToConfirm } = useContractWrite({
    ...withdrawConfig,
    request: {
      ...withdrawConfig.request,
      gasLimit,
    },
    onSuccess(data) {
      setPendingTxn(data);
    },
  });

  let confirmButtonState: ConfirmButtonState = ConfirmButtonState.READY;
  if (withdrawAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else if (isRedeemingTooMuch) {
    confirmButtonState = ConfirmButtonState.REDEEM_TOO_MUCH;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      color={MODAL_BLACK_TEXT_COLOR}
      onClick={() => withdraw?.()}
      disabled={!confirmButton.enabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type RemoveCollateralModalContentProps = {
  borrower: BorrowerNftBorrower;
  setPendingTxnResult: (result: SendTransactionResult | null) => void;
};

export default function RemoveCollateralModalContent(props: RemoveCollateralModalContentProps) {
  const { borrower, setPendingTxnResult } = props;

  const [withdrawAmountStr, setWithdrawAmountStr] = useState('');

  const { address: accountAddress } = useAccount();

  // TODO: This logic needs to change once we support more complex borrowing
  const isWithdrawingToken0 = borrower.assets.token0Raw > 0;

  // TODO: This logic needs to change once we support more complex borrowing
  const collateralToken = isWithdrawingToken0 ? borrower.token0 : borrower.token1;
  const collateralLender = isWithdrawingToken0 ? borrower.lender0 : borrower.lender1;

  const { data: collateralBalanceStr, refetch: refetchCollateralBalance } = useBalanceOfUnderlying(
    collateralToken,
    collateralLender,
    accountAddress ?? '0x'
  );

  // TODO: This assumes that the borrowing token is always the opposite of the collateral token
  // and that only one token is borrowed and one token is collateralized
  const numericExistingCollateral = isWithdrawingToken0 ? borrower.assets.token0Raw : borrower.assets.token1Raw;
  const existingCollateral = GN.fromNumber(numericExistingCollateral, collateralToken.decimals);
  const withdrawAmount = GN.fromDecimalString(withdrawAmountStr || '0', collateralToken.decimals);
  const newCollateralAmount = existingCollateral.sub(withdrawAmount);
  const collateralBalance = GN.fromDecimalString(collateralBalanceStr || '0', collateralToken.decimals);

  const numericMaxWithdrawAmount = maxWithdraws(
    borrower.assets,
    borrower.liabilities,
    [], // TODO: Add uniswap positions
    borrower.sqrtPriceX96,
    borrower.iv,
    borrower.nSigma,
    borrower.token0.decimals,
    borrower.token1.decimals
  )[isWithdrawingToken0 ? 0 : 1];

  const maxWithdrawAmount = GN.fromNumber(numericMaxWithdrawAmount, collateralToken.decimals);

  const max = GN.min(maxWithdrawAmount, collateralBalance);
  const maxStr = max.toString(GNFormat.DECIMAL);

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
      <div className='flex justify-between items-center mb-8'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
          Updated Collateral Amount
        </Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
          {newCollateralAmount.toString(GNFormat.LOSSY_HUMAN)} {collateralToken.symbol}
        </Text>
      </div>
      <div className='w-full ml-auto'>
        <ConfirmButton
          withdrawAmount={withdrawAmount}
          maxWithdrawAmount={maxWithdrawAmount}
          borrower={borrower}
          token={collateralToken}
          isWithdrawingToken0={isWithdrawingToken0}
          accountAddress={accountAddress || '0x'}
          setPendingTxn={setPendingTxnResult}
        />
      </div>
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By withdrawing, you agree to our{' '}
        <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </>
  );
}
