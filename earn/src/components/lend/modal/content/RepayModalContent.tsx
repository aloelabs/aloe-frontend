import { useContext, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import {
  DashedDivider,
  LABEL_TEXT_COLOR,
  MODAL_BLACK_TEXT_COLOR,
  VALUE_TEXT_COLOR,
} from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { Address, useAccount } from 'wagmi';

import { ChainContext } from '../../../../App';
import { BorrowerNftBorrower } from '../../../../data/BorrowerNft';

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
  accountAddress: Address;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function ConfirmButton(props: ConfirmButtonProps) {
  const { repayAmount, repayTokenBalance, totalBorrowedAmount, borrower, token, accountAddress, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [isPending, setIsPending] = useState(false);

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

  // TODO: This logic needs to change once we support more complex borrowing
  const repayingToken = borrower.assets.token0Raw > 0 ? borrower.token1 : borrower.token0;
  // TODO: This assumes that the borrowing token is always the opposite of the collateral token
  // and that only one token is borrowed and one token is collateralized
  const currentlyBorrowedAmount = GN.fromNumber(
    borrower.liabilities.amount0 + borrower.liabilities.amount1,
    repayingToken.decimals
  );
  const repayAmount = GN.fromDecimalString(repayAmountStr || '0', repayingToken.decimals);
  const newBorrowedAmount = currentlyBorrowedAmount.sub(repayAmount);

  return (
    <>
      <div className='flex justify-between items-center mb-4'>
        <TokenAmountInput
          token={repayingToken}
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
          {newBorrowedAmount.toString(GNFormat.LOSSY_HUMAN)} {repayingToken.symbol}
        </Text>
      </div>
      <div className='w-full ml-auto'>
        <ConfirmButton
          repayAmount={repayAmount}
          repayTokenBalance={GN.zero(repayingToken.decimals)}
          totalBorrowedAmount={currentlyBorrowedAmount}
          borrower={borrower}
          token={repayingToken}
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
