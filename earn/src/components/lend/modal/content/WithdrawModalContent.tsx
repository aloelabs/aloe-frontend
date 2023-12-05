import { useContext, useEffect, useMemo, useState } from 'react';

import { Address, SendTransactionResult } from '@wagmi/core';
import { BigNumber } from 'ethers';
import { lenderAbi } from 'shared/lib/abis/Lender';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import {
  DashedDivider,
  LABEL_TEXT_COLOR,
  MODAL_BLACK_TEXT_COLOR,
  VALUE_TEXT_COLOR,
} from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';

const GAS_ESTIMATE_WIGGLE_ROOM = 110;
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_KITTY,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(state: ConfirmButtonState, kitty: Kitty): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_KITTY:
      return {
        text: `Insufficient ${kitty.symbol}`,
        enabled: false,
      };
    case ConfirmButtonState.LOADING:
      return { text: 'Confirm', enabled: false };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type WithdrawButtonProps = {
  withdrawAmount: GN;
  maxWithdrawBalance: GN;
  maxRedeemBalance: GN;
  token: Token;
  kitty: Kitty;
  accountAddress: Address;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function WithdrawButton(props: WithdrawButtonProps) {
  const { withdrawAmount, maxWithdrawBalance, maxRedeemBalance, token, kitty, accountAddress, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [isPending, setIsPending] = useState(false);

  // Doesn't need to be watched, just read once
  const { data: requestedShares, isLoading: convertToSharesIsLoading } = useContractRead({
    address: kitty.address,
    abi: lenderAbi,
    functionName: 'convertToShares',
    args: [withdrawAmount.toBigNumber()],
    chainId: activeChain.id,
  });

  const gnRequestedShares = GN.fromBigNumber(requestedShares ?? BigNumber.from('0'), token.decimals);
  // Being extra careful here to make sure we don't withdraw more than the user has
  const numberOfSharesToRedeem = GN.min(gnRequestedShares, maxRedeemBalance);

  const { config: redeemConfig } = usePrepareContractWrite({
    address: kitty.address,
    abi: lenderAbi,
    functionName: 'redeem',
    args: [numberOfSharesToRedeem.toBigNumber(), accountAddress, accountAddress],
    chainId: activeChain.id,
    enabled: !numberOfSharesToRedeem.isZero() && !isPending,
  });
  const redeemUpdatedRequest = useMemo(() => {
    if (redeemConfig.request) {
      return {
        ...redeemConfig.request,
        gasLimit: redeemConfig.request.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100),
      };
    }
    return undefined;
  }, [redeemConfig.request]);
  const {
    write: contractWrite,
    isSuccess: contractDidSucceed,
    isLoading: contractIsLoading,
    data: contractData,
  } = useContractWrite({
    ...redeemConfig,
    request: redeemUpdatedRequest,
  });

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
    } else if (!contractIsLoading && !contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractIsLoading, setPendingTxn]);

  let confirmButtonState = ConfirmButtonState.READY;

  if (withdrawAmount.gt(maxWithdrawBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_KITTY;
  } else if (isPending || convertToSharesIsLoading) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (withdrawAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (!redeemConfig.request) {
    confirmButtonState = ConfirmButtonState.LOADING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, kitty);

  function handleClickConfirm() {
    if (confirmButtonState === ConfirmButtonState.READY && requestedShares) {
      setIsPending(true);
      contractWrite?.();
    }
  }

  const isDepositAmountValid = withdrawAmount.isGtZero();
  const shouldConfirmButtonBeDisabled = !(confirmButton.enabled && isDepositAmountValid);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      color={MODAL_BLACK_TEXT_COLOR}
      onClick={handleClickConfirm}
      disabled={shouldConfirmButtonBeDisabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type WithdrawModalContentProps = {
  token: Token;
  kitty: Kitty;
  setPendingTxnResult: (result: SendTransactionResult | null) => void;
};

export default function WithdrawModalContent(props: WithdrawModalContentProps) {
  const { token, kitty, setPendingTxnResult } = props;
  const { activeChain } = useContext(ChainContext);

  const [withdrawAmount, setWithdrawAmount] = useState('');

  const { address: accountAddress } = useAccount();

  const { refetch: refetchMaxWithdraw, data: maxWithdraw } = useContractRead({
    address: kitty.address,
    abi: lenderAbi,
    functionName: 'maxWithdraw',
    chainId: activeChain.id,
    args: [accountAddress || '0x'],
    enabled: Boolean(accountAddress),
  });

  const { refetch: refetchMaxRedeem, data: maxRedeem } = useContractRead({
    address: kitty.address,
    abi: lenderAbi,
    functionName: 'maxRedeem',
    chainId: activeChain.id,
    args: [accountAddress || '0x'],
    enabled: Boolean(accountAddress),
  });

  const gnWithdrawAmount = GN.fromDecimalString(withdrawAmount || '0', token.decimals);
  const gnMaxWithdraw = GN.fromBigNumber(maxWithdraw ?? BigNumber.from(0), token.decimals);
  const gnMaxRedeem = GN.fromBigNumber(maxRedeem ?? BigNumber.from(0), token.decimals);

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    interval = setInterval(() => {
      refetchMaxRedeem();
      refetchMaxWithdraw();
    }, 13_000);
    return () => {
      if (interval != null) {
        clearInterval(interval);
      }
    };
  }, [refetchMaxRedeem, refetchMaxWithdraw]);

  return (
    <>
      <div className='flex justify-between items-center mb-4'>
        <TokenAmountInput
          token={token}
          onChange={(updatedAmount: string) => {
            setWithdrawAmount(updatedAmount);
          }}
          value={withdrawAmount}
          max={gnMaxWithdraw.toString(GNFormat.DECIMAL)}
          maxed={gnWithdrawAmount.eq(gnMaxWithdraw)}
        />
      </div>
      <div className='flex justify-between items-center mb-8'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
          Estimated Total
        </Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
          {withdrawAmount || '0'} {token?.symbol}
        </Text>
      </div>
      <div className='w-full ml-auto'>
        <WithdrawButton
          accountAddress={accountAddress || '0x'}
          token={token}
          kitty={kitty}
          withdrawAmount={gnWithdrawAmount}
          maxRedeemBalance={gnMaxRedeem}
          maxWithdrawBalance={gnMaxWithdraw}
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
