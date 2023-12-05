import { useContext, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber, ethers } from 'ethers';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { permit2Abi } from 'shared/lib/abis/Permit2';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { MODAL_BLACK_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_BORROWER_NFT_ADDRESS, ALOE_II_PERMIT2_MANAGER_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Permit2State, usePermit2 } from 'shared/lib/data/hooks/UsePermit2';
import { Token } from 'shared/lib/data/Token';
import { Address, useAccount, useBalance, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import { isSolvent } from '../../../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../../../data/BorrowerNft';
import { Liabilities } from '../../../../data/MarginAccount';
import HealthBar from '../../../borrow/HealthBar';

const GAS_ESTIMATE_WIGGLE_ROOM = 110;
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_FUNDS,
  PERMIT_ASSET,
  APPROVE_ASSET,
  REPAYING_TOO_MUCH,
  WAITING_FOR_USER,
  WAITING_FOR_TRANSACTION,
  READY,
  LOADING,
  DISABLED,
}

const permit2StateToButtonStateMap = {
  [Permit2State.ASKING_USER_TO_APPROVE]: ConfirmButtonState.WAITING_FOR_USER,
  [Permit2State.ASKING_USER_TO_SIGN]: ConfirmButtonState.WAITING_FOR_USER,
  [Permit2State.DONE]: undefined,
  [Permit2State.FETCHING_DATA]: ConfirmButtonState.LOADING,
  [Permit2State.READY_TO_APPROVE]: ConfirmButtonState.APPROVE_ASSET,
  [Permit2State.READY_TO_SIGN]: ConfirmButtonState.PERMIT_ASSET,
  [Permit2State.WAITING_FOR_TRANSACTION]: ConfirmButtonState.WAITING_FOR_TRANSACTION,
};

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_FUNDS:
      return { text: `Insufficient ${token.symbol}`, enabled: false };
    case ConfirmButtonState.PERMIT_ASSET:
      return {
        text: `Permit ${token.symbol}`,
        enabled: true,
      };
    case ConfirmButtonState.APPROVE_ASSET:
      return {
        text: `Approve ${token.symbol}`,
        enabled: true,
      };
    case ConfirmButtonState.REPAYING_TOO_MUCH:
      return { text: 'Repaying too much', enabled: false };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading...', enabled: false };
    case ConfirmButtonState.WAITING_FOR_TRANSACTION:
      return { text: 'Pending', enabled: false };
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
  userAddress: Address;
  setIsOpen: (isOpen: boolean) => void;
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
    userAddress,
    setIsOpen,
    setPendingTxn,
  } = props;
  const { activeChain } = useContext(ChainContext);

  const {
    state: permit2State,
    action: permit2Action,
    result: permit2Result,
  } = usePermit2(activeChain, token, userAddress, ALOE_II_PERMIT2_MANAGER_ADDRESS[activeChain.id], repayAmount);

  const encodedPermit2 = useMemo(() => {
    if (!userAddress || !permit2Result.signature) return null;
    const permit2 = new ethers.utils.Interface(permit2Abi);
    return permit2.encodeFunctionData(
      'permitTransferFrom(((address,uint256),uint256,uint256),(address,uint256),address,bytes)',
      [
        {
          permitted: {
            token: token.address,
            amount: permit2Result.amount.toBigNumber(),
          },
          nonce: BigNumber.from(permit2Result.nonce ?? '0'),
          deadline: BigNumber.from(permit2Result.deadline),
        },
        {
          to: borrower.address,
          requestedAmount: permit2Result.amount.toBigNumber(),
        },
        userAddress,
        permit2Result.signature,
      ]
    );
  }, [
    borrower.address,
    permit2Result.amount,
    permit2Result.deadline,
    permit2Result.nonce,
    permit2Result.signature,
    token.address,
    userAddress,
  ]);

  const encodedRepayCall = useMemo(() => {
    if (!userAddress) return null;
    const borrowerInterface = new ethers.utils.Interface(borrowerAbi);
    const amount0 = isRepayingToken0 ? repayAmount : GN.zero(borrower.token0.decimals);
    const amount1 = isRepayingToken0 ? GN.zero(borrower.token1.decimals) : repayAmount;

    return borrowerInterface.encodeFunctionData('repay', [
      amount0.toBigNumber(),
      amount1.toBigNumber(),
    ]) as `0x${string}`;
  }, [repayAmount, borrower.token0.decimals, borrower.token1.decimals, isRepayingToken0, userAddress]);

  const encodedModifyCall = useMemo(() => {
    if (!encodedPermit2 || !encodedRepayCall) return null;
    return encodedPermit2.concat(encodedRepayCall.slice(2)) as `0x${string}`;
  }, [encodedPermit2, encodedRepayCall]);

  const { config: repayConfig, isLoading: isCheckingIfAbleToRepay } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      userAddress ?? '0x',
      [borrower.index],
      [ALOE_II_PERMIT2_MANAGER_ADDRESS[activeChain.id]],
      [encodedModifyCall ?? '0x'],
      [0],
    ],
    chainId: activeChain.id,
    enabled: userAddress && encodedModifyCall != null,
  });
  const gasLimit = repayConfig.request?.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100);
  const { write: repay, isLoading: isAskingUserToConfirm } = useContractWrite({
    ...repayConfig,
    request: {
      ...repayConfig.request,
      gasLimit,
    },
    onSuccess(data) {
      setIsOpen(false);
      setPendingTxn(data);
    },
  });

  let confirmButtonState: ConfirmButtonState;

  if (isCheckingIfAbleToRepay) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (repayAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else if (
    permit2State === Permit2State.ASKING_USER_TO_SIGN ||
    permit2State === Permit2State.ASKING_USER_TO_APPROVE ||
    isAskingUserToConfirm
  ) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_USER;
  } else if (repayAmount.gt(repayTokenBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_FUNDS;
  } else if (repayAmount.gt(totalBorrowedAmount)) {
    confirmButtonState = ConfirmButtonState.REPAYING_TOO_MUCH;
  } else if (permit2State === Permit2State.DONE && !repayConfig.request) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else {
    confirmButtonState = permit2StateToButtonStateMap[permit2State] ?? ConfirmButtonState.READY;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      color={MODAL_BLACK_TEXT_COLOR}
      onClick={() => {
        if (permit2State !== Permit2State.DONE) {
          permit2Action?.();
        } else {
          repay?.();
        }
      }}
      disabled={!confirmButton.enabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type RepayModalContentProps = {
  borrower: BorrowerNftBorrower;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxnResult: (result: SendTransactionResult | null) => void;
};

export default function RepayModalContent(props: RepayModalContentProps) {
  const { borrower, setIsOpen, setPendingTxnResult } = props;

  const [repayAmountStr, setRepayAmountStr] = useState('');

  const { address: userAddress } = useAccount();
  const { activeChain } = useContext(ChainContext);

  // TODO: This assumes that the borrowing token is always the opposite of the collateral token
  // and that only one token is borrowed and one token is collateralized
  const isRepayingToken0 = borrower.assets.token1Raw > 0;

  // TODO: This logic needs to change once we support more complex borrowing
  const repayToken = isRepayingToken0 ? borrower.token0 : borrower.token1;

  const { data: tokenBalanceData } = useBalance({
    address: userAddress,
    chainId: activeChain.id,
    token: repayToken.address,
    watch: false,
    enabled: userAddress !== undefined,
  });
  const tokenBalance = GN.fromDecimalString(tokenBalanceData?.formatted ?? '0', repayToken.decimals);

  // TODO: This assumes that the borrowing token is always the opposite of the collateral token
  // and that only one token is borrowed and one token is collateralized
  const numericExistingLiability = isRepayingToken0 ? borrower.liabilities.amount0 : borrower.liabilities.amount1;
  const existingLiability = GN.fromNumber(numericExistingLiability, repayToken.decimals);
  const repayAmount = GN.fromDecimalString(repayAmountStr || '0', repayToken.decimals);
  const newLiability = existingLiability.sub(repayAmount);

  const maxRepayStr = GN.min(existingLiability, tokenBalance).toString(GNFormat.DECIMAL);
  // NOTE: Don't just use `repayAmountStr === maxRepayStr` because the max repay flow will fail
  // if `tokenBalance` is the constraint.
  const shouldRepayMax = repayAmountStr === existingLiability.toString(GNFormat.DECIMAL);

  // TODO: use GN
  const newLiabilities: Liabilities = {
    amount0: isRepayingToken0 ? newLiability.toNumber() : borrower.liabilities.amount0,
    amount1: isRepayingToken0 ? borrower.liabilities.amount1 : newLiability.toNumber(),
  };

  const { health: newHealth } = isSolvent(
    borrower.assets,
    newLiabilities,
    [], // TODO: add uniswap positions
    borrower.sqrtPriceX96,
    borrower.iv,
    borrower.nSigma,
    borrower.token0.decimals,
    borrower.token1.decimals
  );

  return (
    <>
      <div className='flex justify-between items-center mb-4'>
        <TokenAmountInput
          token={repayToken}
          onChange={(updatedAmount: string) => {
            setRepayAmountStr(updatedAmount);
          }}
          value={repayAmountStr}
          max={maxRepayStr}
          maxed={shouldRepayMax}
        />
      </div>
      <div className='flex flex-col gap-1 w-full'>
        <Text size='M' weight='bold'>
          Summary
        </Text>
        <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
          You're repaying{' '}
          <strong>
            {repayAmountStr || '0.00'} {repayToken.symbol}
          </strong>{' '}
          using this{' '}
          <strong>
            {borrower.token0.symbol}/{borrower.token1.symbol}
          </strong>{' '}
          smart wallet. Your total borrows for this token in this smart wallet will be{' '}
          <strong>
            {newLiability.toString(GNFormat.DECIMAL)} {repayToken.symbol}
          </strong>
          .
        </Text>
        <div className='mt-2'>
          <HealthBar health={newHealth} />
        </div>
      </div>
      <div className='w-full ml-auto mt-8'>
        <ConfirmButton
          repayAmount={repayAmount}
          repayTokenBalance={tokenBalance}
          totalBorrowedAmount={existingLiability}
          borrower={borrower}
          token={repayToken}
          isRepayingToken0={isRepayingToken0}
          userAddress={userAddress ?? '0x'}
          setIsOpen={setIsOpen}
          setPendingTxn={setPendingTxnResult}
        />
      </div>
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By repaying, you agree to our{' '}
        <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </>
  );
}
