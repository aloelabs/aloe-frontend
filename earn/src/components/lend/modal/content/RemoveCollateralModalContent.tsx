import { useContext, useState } from 'react';

import { Address, SendTransactionResult } from '@wagmi/core';
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
import { useAccount } from 'wagmi';

import { ChainContext } from '../../../../App';
import { BorrowerNftBorrower } from '../../../../data/BorrowerNft';

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
  accountAddress: Address;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function ConfirmButton(props: ConfirmButtonProps) {
  const { withdrawAmount, maxWithdrawAmount, borrower, token, accountAddress, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [isPending, setIsPending] = useState(false);

  let state: ConfirmButtonState = ConfirmButtonState.READY;
  if (withdrawAmount.isZero()) {
    state = ConfirmButtonState.DISABLED;
  } else if (withdrawAmount.gt(maxWithdrawAmount)) {
    state = ConfirmButtonState.REDEEM_TOO_MUCH;
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

export type RemoveCollateralModalContentProps = {
  borrower: BorrowerNftBorrower;
  setPendingTxnResult: (result: SendTransactionResult | null) => void;
};

export default function RemoveCollateralModalContent(props: RemoveCollateralModalContentProps) {
  const { borrower, setPendingTxnResult } = props;

  const [withdrawAmountStr, setWithdrawAmountStr] = useState('');

  const { address: accountAddress } = useAccount();

  // TODO: This logic needs to change once we support more complex borrowing
  const collateralToken = borrower.assets.token0Raw > 0 ? borrower.token0 : borrower.token1;
  // TODO: This assumes that the borrowing token is always the opposite of the collateral token
  // and that only one token is borrowed and one token is collateralized
  const currentCollateralAmount = GN.fromNumber(
    borrower.assets.token0Raw + borrower.assets.token1Raw,
    collateralToken.decimals
  );
  const withdrawAmount = GN.fromDecimalString(withdrawAmountStr || '0', collateralToken.decimals);
  const newCollateralAmount = currentCollateralAmount.sub(withdrawAmount);

  return (
    <>
      <div className='flex justify-between items-center mb-4'>
        <TokenAmountInput
          token={collateralToken}
          onChange={(updatedAmount: string) => {
            setWithdrawAmountStr(updatedAmount);
          }}
          value={withdrawAmountStr}
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
          maxWithdrawAmount={GN.zero(collateralToken.decimals)}
          borrower={borrower}
          token={collateralToken}
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
