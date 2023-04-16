import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import Big from 'big.js';
import { BigNumber, ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import KittyABI from '../../../../assets/abis/Kitty.json';
import { useBalanceOfUnderlying } from '../../../../data/hooks/UseUnderlyingBalanceOf';
import { Kitty } from '../../../../data/Kitty';
import { Token } from '../../../../data/Token';
import { DashedDivider, LABEL_TEXT_COLOR, MODAL_BLACK_TEXT_COLOR, VALUE_TEXT_COLOR } from '../../../common/Modal';
import TokenAmountInput from '../../../common/TokenAmountInput';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room
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
        text: `Insufficient ${kitty.ticker}`,
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
  withdrawAmount: Big;
  maxWithdrawBalance: Big;
  maxRedeemBalance: Big;
  token: Token;
  kitty: Kitty;
  accountAddress: string;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function WithdrawButton(props: WithdrawButtonProps) {
  const { withdrawAmount, maxWithdrawBalance, maxRedeemBalance, token, kitty, accountAddress, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [isPending, setIsPending] = useState(false);

  // Doesn't need to be watched, just read once
  const { data: requestedShares, isLoading: convertToSharesIsLoading } = useContractRead({
    address: kitty.address,
    abi: KittyABI,
    functionName: 'convertToShares',
    args: [ethers.utils.parseUnits(withdrawAmount.toFixed(token.decimals), token.decimals)],
    chainId: activeChain.id,
  });

  const numericRequestedShares = requestedShares ? BigNumber.from(requestedShares.toString()) : BigNumber.from(0);
  const numericMaxRedeemBalance = BigNumber.from(maxRedeemBalance.toFixed());
  // Being extra careful here to make sure we don't withdraw more than the user has
  const finalWithdrawAmount = numericRequestedShares.gt(numericMaxRedeemBalance)
    ? numericMaxRedeemBalance
    : numericRequestedShares;

  const { config: withdrawConfig } = usePrepareContractWrite({
    address: kitty.address,
    abi: KittyABI,
    functionName: 'redeem',
    args: [finalWithdrawAmount.toString(), accountAddress, accountAddress],
    chainId: activeChain.id,
    enabled: finalWithdrawAmount.gt(0) && !isPending,
  });
  const withdrawUpdatedRequest = useMemo(() => {
    if (withdrawConfig.request) {
      return {
        ...withdrawConfig.request,
        gasLimit: withdrawConfig.request.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100),
      };
    }
    return undefined;
  }, [withdrawConfig.request]);
  const {
    write: contractWrite,
    isSuccess: contractDidSucceed,
    isLoading: contractIsLoading,
    data: contractData,
  } = useContractWrite({
    ...withdrawConfig,
    request: withdrawUpdatedRequest,
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
  } else if (finalWithdrawAmount.eq(0)) {
    confirmButtonState = ConfirmButtonState.LOADING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, kitty);

  function handleClickConfirm() {
    if (confirmButtonState === ConfirmButtonState.READY && requestedShares) {
      setIsPending(true);
      contractWrite?.();
    }
  }

  const isDepositAmountValid = withdrawAmount.gt(0);
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
    abi: KittyABI,
    functionName: 'maxWithdraw',
    chainId: activeChain.id,
    args: [accountAddress] as const,
  });

  const { refetch: refetchMaxRedeem, data: maxRedeem } = useContractRead({
    address: kitty.address,
    abi: KittyABI,
    functionName: 'maxRedeem',
    chainId: activeChain.id,
    args: [accountAddress] as const,
  });

  const { refetch: refetchBalanceOfUnderlying, data: balanceOfUnderlying } = useBalanceOfUnderlying(
    token,
    kitty,
    accountAddress || ''
  );

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    interval = setInterval(() => {
      refetchBalanceOfUnderlying();
      refetchMaxRedeem();
      refetchMaxWithdraw();
    }, 13_000);
    return () => {
      if (interval != null) {
        clearInterval(interval);
      }
    };
  }, [refetchBalanceOfUnderlying, refetchMaxRedeem, refetchMaxWithdraw]);

  const bigWithdrawAmount = withdrawAmount ? new Big(withdrawAmount).mul(10 ** token.decimals) : new Big(0);
  const bigMaxWithdraw: Big = maxWithdraw ? new Big(maxWithdraw.toString()) : new Big(0);
  const bigMaxRedeem: Big = maxRedeem ? new Big(maxRedeem.toString()) : new Big(0);

  const underlyingBalance = balanceOfUnderlying ?? '0';

  return (
    <>
      <div className='flex justify-between items-center mb-4'>
        <TokenAmountInput
          token={token}
          onChange={(updatedAmount: string) => {
            setWithdrawAmount(updatedAmount);
          }}
          value={withdrawAmount}
          max={underlyingBalance}
          maxed={withdrawAmount === underlyingBalance}
        />
      </div>
      <div className='flex justify-between items-center mb-8'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
          Estimated Total
        </Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
          {withdrawAmount || '0'} {token?.ticker}
        </Text>
      </div>
      <div className='w-full ml-auto'>
        <WithdrawButton
          accountAddress={accountAddress || '0x'}
          token={token}
          kitty={kitty}
          withdrawAmount={bigWithdrawAmount}
          maxRedeemBalance={bigMaxRedeem}
          maxWithdrawBalance={bigMaxWithdraw}
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
