import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber } from 'ethers';
import { routerABI } from 'shared/lib/abis/Router';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { DashedDivider, LABEL_TEXT_COLOR, VALUE_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { GN } from 'shared/lib/data/GoodNumber';
import { usePermit2, Permit2State } from 'shared/lib/data/hooks/UsePermit2';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import { Address, useAccount, useBalance, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import { ALOE_II_ROUTER_ADDRESS } from '../../../../data/constants/Addresses';
import TokenAmountInput from '../../../common/TokenAmountInput';

const TERTIARY_COLOR = '#4b6980';
const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  PERMIT_ASSET,
  APPROVE_ASSET,
  WAITING_FOR_TRANSACTION,
  WAITING_FOR_USER,
  LOADING,
  READY,
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
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.symbol}`,
        enabled: false,
      };
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
    case ConfirmButtonState.WAITING_FOR_TRANSACTION:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type DepositButtonProps = {
  depositAmount: GN;
  depositBalance: GN;
  token: Token;
  kitty: Kitty;
  accountAddress: Address;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function DepositButton(props: DepositButtonProps) {
  const { depositAmount, depositBalance, token, kitty, accountAddress, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [isPending, setIsPending] = useState(false);

  const {
    state: permit2State,
    action: permit2Action,
    result: permit2Result,
  } = usePermit2(activeChain, token, accountAddress, ALOE_II_ROUTER_ADDRESS, depositAmount);

  const { config: depositWithPermit2Config, refetch: refetchDepositWithPermit2 } = usePrepareContractWrite({
    address: ALOE_II_ROUTER_ADDRESS,
    abi: routerABI,
    functionName: 'depositWithPermit2',
    args: [
      kitty.address,
      permit2Result.amount.toBigNumber(),
      BigNumber.from(permit2Result.nonce ?? '0'),
      BigNumber.from(permit2Result.deadline),
      permit2Result.signature ?? '0x',
    ],
    chainId: activeChain.id,
    enabled: permit2State === Permit2State.DONE,
  });
  const depositWithPermit2ConfigUpdatedRequest = useMemo(() => {
    if (depositWithPermit2Config.request) {
      return {
        ...depositWithPermit2Config.request,
        gasLimit: depositWithPermit2Config.request.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100),
      };
    }
    return undefined;
  }, [depositWithPermit2Config.request]);
  const {
    write: depositWithPermit2,
    isError: contractDidError,
    isSuccess: contractDidSucceed,
    data: contractData,
  } = useContractWrite({
    ...depositWithPermit2Config,
    request: depositWithPermit2ConfigUpdatedRequest,
  });

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
    } else if (contractDidError) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractDidError, setPendingTxn]);

  let confirmButtonState: ConfirmButtonState;
  if (isPending) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_TRANSACTION;
  } else if (depositAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (depositAmount.gt(depositBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else {
    confirmButtonState = permit2StateToButtonStateMap[permit2State] ?? ConfirmButtonState.READY;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  function handleClickConfirm() {
    if (permit2Action) {
      permit2Action();
      return;
    }

    if (confirmButtonState === ConfirmButtonState.READY) {
      if (!depositWithPermit2Config.request) {
        refetchDepositWithPermit2();
        return;
      }
      setIsPending(true);
      depositWithPermit2?.();
    }
  }

  return (
    <FilledStylizedButton
      size='M'
      onClick={() => handleClickConfirm()}
      fillWidth={true}
      disabled={!confirmButton.enabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type DepositModalContentProps = {
  token: Token;
  kitty: Kitty;
  setPendingTxnResult: (result: SendTransactionResult | null) => void;
};

export default function DepositModalContent(props: DepositModalContentProps) {
  const { token, kitty, setPendingTxnResult } = props;
  const { activeChain } = useContext(ChainContext);

  const [depositAmount, setDepositAmount] = useState('');
  const account = useAccount();

  const { refetch: refetchBalance, data: depositBalance } = useBalance({
    address: account?.address ?? '0x',
    token: token.address,
    enabled: account.address !== undefined,
    chainId: activeChain.id,
  });

  useEffect(() => {
    const interval = setInterval(() => refetchBalance(), 13_000);
    return () => clearInterval(interval);
  }, [refetchBalance]);

  const gnDepositAmount = GN.fromDecimalString(depositAmount || '0', token.decimals);
  const gnDepositBalance = GN.fromDecimalString(depositBalance?.formatted ?? '0', token.decimals);

  return (
    <>
      <div className='flex justify-between items-center mb-4'>
        <TokenAmountInput
          token={token}
          onChange={(updatedAmount: string) => {
            setDepositAmount(updatedAmount);
          }}
          value={depositAmount}
          max={depositBalance?.formatted ?? '0'}
          maxed={depositAmount === depositBalance?.formatted ?? '0'}
        />
      </div>
      <div className='flex justify-between items-center mb-8'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
          Estimated Total
        </Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
          {depositAmount || 0} {token?.symbol}
        </Text>
      </div>
      <div className='w-full'>
        <DepositButton
          depositAmount={gnDepositAmount}
          depositBalance={gnDepositBalance}
          token={token}
          kitty={kitty}
          accountAddress={account.address ?? '0x'}
          setPendingTxn={setPendingTxnResult}
        />
        <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
          By depositing, you agree to our{' '}
          <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
            Terms of Service
          </a>{' '}
          and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
          your duty to educate yourself and be aware of the risks.
        </Text>
      </div>
    </>
  );
}
