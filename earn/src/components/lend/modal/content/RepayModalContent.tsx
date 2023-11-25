import { useContext, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
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
import { Address, useAccount, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import { BorrowerNftBorrower } from '../../../../data/BorrowerNft';

const GAS_ESTIMATE_WIGGLE_ROOM = 110;
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_FUNDS,
  REPAYING_TOO_MUCH,
  PERMIT_ASSET,
  APPROVE_ASSET,
  WAITING_FOR_TRANSACTION,
  WAITING_FOR_USER,
  READY,
  LOADING,
  DISABLED,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_FUNDS:
      return { text: `Insufficient ${token.symbol}`, enabled: false };
    case ConfirmButtonState.REPAYING_TOO_MUCH:
      return { text: 'Repaying too much', enabled: false };
    case ConfirmButtonState.PERMIT_ASSET:
      return { text: `Permit ${token.symbol}`, enabled: true };
    case ConfirmButtonState.APPROVE_ASSET:
      return { text: `Approve ${token.symbol}`, enabled: true };
    case ConfirmButtonState.WAITING_FOR_TRANSACTION:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type ConfirmButtonProps = {
  repayAmount: GN;
  repayTokenBalance: GN;
  totalBorrowedAmount: GN;
  borrower: BorrowerNftBorrower;
  token: Token;
  isRepayingToken0: boolean;
  accountAddress: Address;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function ConfirmButton(props: ConfirmButtonProps) {
  const {
    repayAmount,
    repayTokenBalance,
    totalBorrowedAmount,
    borrower,
    token,
    isRepayingToken0,
    accountAddress,
    setPendingTxn,
  } = props;
  const { activeChain } = useContext(ChainContext);

  const encodedRepayCall = useMemo(() => {
    if (!accountAddress) return null;
    const borrowerInterface = new ethers.utils.Interface(borrowerAbi);
    const amount0 = isRepayingToken0 ? repayAmount : GN.zero(borrower.token0.decimals);
    const amount1 = isRepayingToken0 ? GN.zero(borrower.token1.decimals) : repayAmount;

    return borrowerInterface.encodeFunctionData('repay', [
      amount0.toBigNumber(),
      amount1.toBigNumber(),
    ]) as `0x${string}`;
  }, [repayAmount, borrower.token0.decimals, borrower.token1.decimals, isRepayingToken0, accountAddress]);

  const { config: repayConfig, isLoading: isCheckingIfAbleToRepay } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      accountAddress ?? '0x',
      [borrower.index],
      [ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS[activeChain.id]],
      [encodedRepayCall ?? '0x'],
      [0],
    ],
    chainId: activeChain.id,
    enabled: accountAddress && encodedRepayCall != null,
  });
  const gasLimit = repayConfig.request?.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100);
  const { write: repay, isLoading: isAskingUserToConfirm } = useContractWrite({
    ...repayConfig,
    request: {
      ...repayConfig.request,
      gasLimit,
    },
    onSuccess(data) {
      setPendingTxn(data);
    },
  });

  let state: ConfirmButtonState = ConfirmButtonState.READY;

  if (repayAmount.isZero()) {
    state = ConfirmButtonState.DISABLED;
  } else if (repayAmount.gt(repayTokenBalance)) {
    state = ConfirmButtonState.INSUFFICIENT_FUNDS;
  } else if (repayAmount.gt(totalBorrowedAmount)) {
    state = ConfirmButtonState.REPAYING_TOO_MUCH;
  }

  const confirmButton = getConfirmButton(state, token);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      color={MODAL_BLACK_TEXT_COLOR}
      onClick={() => {
        // TODO
      }}
      disabled={!confirmButton.enabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type RepayModalContentProps = {
  borrower: BorrowerNftBorrower;
  setPendingTxnResult: (result: SendTransactionResult | null) => void;
};

export default function RepayModalContent(props: RepayModalContentProps) {
  const { borrower } = props;

  const [repayAmountStr, setRepayAmountStr] = useState('');

  const { address: accountAddress } = useAccount();

  // TODO: This assumes that the borrowing token is always the opposite of the collateral token
  // and that only one token is borrowed and one token is collateralized
  const isRepayingToken0 = borrower.assets.token1Raw > 0;

  // TODO: This logic needs to change once we support more complex borrowing
  const repayToken = isRepayingToken0 ? borrower.token0 : borrower.token1;
  // TODO: This assumes that the borrowing token is always the opposite of the collateral token
  // and that only one token is borrowed and one token is collateralized
  const numericExistingLiability = isRepayingToken0 ? borrower.liabilities.amount0 : borrower.liabilities.amount1;
  const existingLiability = GN.fromNumber(numericExistingLiability, repayToken.decimals);
  const repayAmount = GN.fromDecimalString(repayAmountStr || '0', repayToken.decimals);
  const newLiability = existingLiability.sub(repayAmount);

  return (
    <>
      <div className='flex justify-between items-center mb-4'>
        <TokenAmountInput
          token={repayToken}
          onChange={(updatedAmount: string) => {
            setRepayAmountStr(updatedAmount);
          }}
          value={repayAmountStr}
        />
      </div>
      <div className='flex justify-between items-center mb-8'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
          Updated Borrowed Amount
        </Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
          {newLiability.toString(GNFormat.LOSSY_HUMAN)} {repayToken.symbol}
        </Text>
      </div>
      <div className='w-full ml-auto'>
        <ConfirmButton
          repayAmount={repayAmount}
          repayTokenBalance={GN.zero(repayToken.decimals)}
          totalBorrowedAmount={existingLiability}
          borrower={borrower}
          token={repayToken}
          isRepayingToken0={isRepayingToken0}
          accountAddress={accountAddress ?? '0x'}
          setPendingTxn={props.setPendingTxnResult}
        />
      </div>
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By repaying, you agree to our{' '}
        <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </>
  );
}
