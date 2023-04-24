import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import Big from 'big.js';
import { BigNumber, ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import { useAccount, useContractRead, useContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import KittyABI from '../../../../assets/abis/Kitty.json';
import { useBalanceOfUnderlying } from '../../../../data/hooks/UseUnderlyingBalanceOf';
import { DashedDivider, LABEL_TEXT_COLOR, MODAL_BLACK_TEXT_COLOR, VALUE_TEXT_COLOR } from '../../../common/Modal';
import TokenAmountInput from '../../../common/TokenAmountInput';

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
  withdrawAmount: string;
  maxWithdrawBalance: string;
  maxRedeemBalance: string;
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
    args: [ethers.utils.parseUnits(withdrawAmount || '0.00', token.decimals).toString()],
    chainId: activeChain.id,
  });

  const {
    write: contractWrite,
    isSuccess: contractDidSucceed,
    isLoading: contractIsLoading,
    data: contractData,
  } = useContractWrite({
    address: kitty.address,
    abi: KittyABI,
    mode: 'recklesslyUnprepared',
    functionName: 'redeem',
    chainId: activeChain.id,
  });

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
    } else if (!contractIsLoading && !contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractIsLoading, setPendingTxn]);

  const numericDepositBalance = Number(maxWithdrawBalance) || 0;
  const numericDepositAmount = Number(withdrawAmount) || 0;

  let confirmButtonState = ConfirmButtonState.READY;

  if (numericDepositAmount > numericDepositBalance) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_KITTY;
  } else if (isPending || convertToSharesIsLoading) {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, kitty);

  function handleClickConfirm() {
    if (confirmButtonState === ConfirmButtonState.READY && requestedShares) {
      setIsPending(true);
      const numericRequestedShares = BigNumber.from(requestedShares.toString());
      const numericMaxRedeemBalance = BigNumber.from(maxRedeemBalance);
      // Being extra careful here to make sure we don't withdraw more than the user has
      const finalWithdrawAmount = numericRequestedShares.gt(numericMaxRedeemBalance)
        ? numericMaxRedeemBalance
        : numericRequestedShares;
      contractWrite?.({
        recklesslySetUnpreparedArgs: [finalWithdrawAmount.toString(), accountAddress, accountAddress],
        recklesslySetUnpreparedOverrides: { gasLimit: BigNumber.from('600000') },
      });
    }
  }

  const isDepositAmountValid = numericDepositAmount > 0;
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

  const maxWithdrawBalance = useMemo(() => {
    if (maxWithdraw) {
      return new Big(maxWithdraw.toString()).div(10 ** token.decimals).toString();
    }
    return '0.00';
  }, [maxWithdraw, token.decimals]);

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
          withdrawAmount={withdrawAmount}
          maxRedeemBalance={maxRedeem ? maxRedeem.toString() : '0'}
          maxWithdrawBalance={maxWithdrawBalance}
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
