import { useContext, useEffect, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber } from 'ethers';
import { routerAbi } from 'shared/lib/abis/Router';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_ROUTER_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Permit2State, usePermit2 } from 'shared/lib/data/hooks/UsePermit2';
import { Token } from 'shared/lib/data/Token';
import { Address, Chain, useAccount, useBalance, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import { isHealthy } from '../../../../data/BalanceSheet';
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
      return { text: 'Loading...', enabled: false };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type ConfirmButtonProps = {
  activeChain: Chain;
  borrower: BorrowerNftBorrower;
  userAddress: Address;
  shouldRepayMax: boolean;
  isRepayingToken0: boolean;
  existingLiabilityGN: GN;
  repayAmount: GN;
  repayToken: Token;
  repayTokenBalance: GN;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function ConfirmButton(props: ConfirmButtonProps) {
  const {
    activeChain,
    shouldRepayMax,
    repayAmount: repayAmountSpecified,
    repayTokenBalance,
    existingLiabilityGN,
    borrower,
    repayToken,
    isRepayingToken0,
    userAddress,
    setIsOpen,
    setPendingTxn,
  } = props;
  const repayAmount = shouldRepayMax ? repayAmountSpecified.recklessMul(1.005) : repayAmountSpecified;

  const [isPending, setIsPending] = useState(false);

  const {
    state: permit2State,
    action: permit2Action,
    result: permit2Result,
  } = usePermit2(activeChain, repayToken, userAddress, ALOE_II_ROUTER_ADDRESS[activeChain.id], repayAmount);

  const { config: repayWithPermit2Config, refetch: refetchRepayWithPermit2 } = usePrepareContractWrite({
    address: ALOE_II_ROUTER_ADDRESS[activeChain.id],
    abi: routerAbi,
    functionName: 'repayWithPermit2',
    args: [
      isRepayingToken0 ? borrower.lender0 : borrower.lender1,
      shouldRepayMax,
      permit2Result.amount.toBigNumber(),
      borrower.address,
      BigNumber.from(permit2Result.nonce ?? '0'),
      BigNumber.from(permit2Result.deadline),
      permit2Result.signature ?? '0x',
    ],
    chainId: activeChain.id,
    enabled: permit2State === Permit2State.DONE,
  });
  const gasLimit = repayWithPermit2Config.request?.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100);
  const {
    write: repayWithPermit2,
    isError: contractDidError,
    isSuccess: contractDidSucceed,
    data: contractData,
  } = useContractWrite({
    ...repayWithPermit2Config,
    request: {
      ...repayWithPermit2Config.request,
      gasLimit,
    },
  });

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
      setIsOpen(false);
    } else if (contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractDidError, setPendingTxn, setIsOpen]);

  // MARK: Determining button state -----------------------------------------------------------------------------------
  let confirmButtonState: ConfirmButtonState;
  if (isPending) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_TRANSACTION;
  } else if (repayAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else if (repayAmount.gt(repayTokenBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_FUNDS;
  } else if (repayAmountSpecified.gt(existingLiabilityGN)) {
    confirmButtonState = ConfirmButtonState.REPAYING_TOO_MUCH;
  } else {
    confirmButtonState = permit2StateToButtonStateMap[permit2State] ?? ConfirmButtonState.READY;
  }

  // MARK: Get the button itself --------------------------------------------------------------------------------------
  // --> UI
  const confirmButton = getConfirmButton(confirmButtonState, repayToken);
  // --> action
  const confirmButtonAction = () => {
    if (permit2Action) {
      permit2Action();
      return;
    }

    if (confirmButtonState === ConfirmButtonState.READY) {
      if (!repayWithPermit2) {
        refetchRepayWithPermit2();
        return;
      }
      setIsPending(true);
      repayWithPermit2();
    }
  };

  return (
    <FilledStylizedButton size='M' fillWidth={true} disabled={!confirmButton.enabled} onClick={confirmButtonAction}>
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

  const { health: newHealth } = isHealthy(
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
          activeChain={activeChain}
          borrower={borrower}
          userAddress={userAddress ?? '0x'}
          existingLiabilityGN={existingLiability}
          shouldRepayMax={shouldRepayMax}
          isRepayingToken0={isRepayingToken0}
          repayAmount={repayAmount}
          repayToken={repayToken}
          repayTokenBalance={tokenBalance}
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
