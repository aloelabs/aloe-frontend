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
import { useAccount, useBalance, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import { BorrowerNftBorrower } from '../../../../data/BorrowerNft';

const GAS_ESTIMATE_WIGGLE_ROOM = 110;
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  PENDING,
  LOADING,
  DISABLED,
  READY,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET:
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
  depositAmount: GN;
  maxDepositAmount: GN;
  borrower: BorrowerNftBorrower;
  token: Token;
  isDepositingToken0: boolean;
  accountAddress: Address;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function ConfirmButton(props: ConfirmButtonProps) {
  const { depositAmount, maxDepositAmount, borrower, token, isDepositingToken0, accountAddress, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [isPending, setIsPending] = useState(false);

  const insufficientAssets = depositAmount.gt(maxDepositAmount);

  const encodedDepositCall = useMemo(() => {
    if (!accountAddress) return null;
    const borrowerInterface = new ethers.utils.Interface(borrowerAbi);
    const amount0 = isDepositingToken0 ? depositAmount : GN.zero(borrower.token0.decimals);
    const amount1 = isDepositingToken0 ? GN.zero(borrower.token1.decimals) : depositAmount;

    return borrowerInterface.encodeFunctionData('transfer', [
      amount0.toBigNumber(),
      amount1.toBigNumber(),
      accountAddress,
    ]) as `0x${string}`;
  }, [depositAmount, borrower.token0.decimals, borrower.token1.decimals, isDepositingToken0, accountAddress]);

  const { config: depositConfig, isLoading: isCheckingIfAbleToDeposit } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      accountAddress ?? '0x',
      [borrower.index],
      [ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS[activeChain.id]],
      [encodedDepositCall ?? '0x'],
      [0],
    ],
    chainId: activeChain.id,
    enabled: accountAddress && encodedDepositCall != null && !insufficientAssets,
  });
  const gasLimit = depositConfig.request?.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100);
  const { write: deposit, isLoading: isAskingUserToConfirm } = useContractWrite({
    ...depositConfig,
    request: {
      ...depositConfig.request,
      gasLimit,
    },
    onSuccess(data) {
      setPendingTxn(data);
    },
  });

  let confirmButtonState: ConfirmButtonState = ConfirmButtonState.READY;

  if (depositAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else if (depositAmount.gt(maxDepositAmount)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      color={MODAL_BLACK_TEXT_COLOR}
      onClick={() => deposit?.()}
      disabled={!confirmButton.enabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type AddCollateralModalContentProps = {
  borrower: BorrowerNftBorrower;
  setPendingTxnResult: (result: SendTransactionResult | null) => void;
};

export default function AddCollateralModalContent(props: AddCollateralModalContentProps) {
  const { borrower, setPendingTxnResult } = props;

  const [depositAmountStr, setDepositAmountStr] = useState('');
  const { activeChain } = useContext(ChainContext);

  const { address: accountAddress } = useAccount();

  const { data: balanceData } = useBalance({
    address: accountAddress,
    token: borrower.token0.address,
    enabled: accountAddress !== undefined,
    chainId: activeChain.id,
  });

  // TODO this logic needs to change once we support more complex borrowing
  const isDepositingToken0 = borrower.assets.token0Raw > 0;

  // TODO: This logic needs to change once we support more complex borrowing
  const collateralToken = isDepositingToken0 ? borrower.token0 : borrower.token1;
  // TODO: This assumes that the borrowing token is always the opposite of the collateral token
  // and that only one token is borrowed and one token is collateralized
  const numericCollateralAmount = isDepositingToken0 ? borrower.assets.token0Raw : borrower.assets.token1Raw;
  const currentCollateralAmount = GN.fromNumber(numericCollateralAmount, collateralToken.decimals);
  const depositAmount = GN.fromDecimalString(depositAmountStr || '0', collateralToken.decimals);
  const newCollateralAmount = currentCollateralAmount.add(depositAmount);
  const maxDepositAmount = GN.fromDecimalString(balanceData?.formatted || '0', collateralToken.decimals);

  return (
    <>
      <div className='flex justify-between items-center mb-4'>
        <TokenAmountInput
          token={collateralToken}
          onChange={(updatedAmount: string) => {
            setDepositAmountStr(updatedAmount);
          }}
          value={depositAmountStr}
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
          depositAmount={depositAmount}
          maxDepositAmount={maxDepositAmount}
          borrower={borrower}
          token={collateralToken}
          isDepositingToken0={isDepositingToken0}
          accountAddress={accountAddress || '0x'}
          setPendingTxn={setPendingTxnResult}
        />
      </div>
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By depositing, you agree to our{' '}
        <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </>
  );
}
