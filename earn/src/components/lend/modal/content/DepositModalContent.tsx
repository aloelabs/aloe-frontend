import { useContext, useEffect, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber, ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount, useBalance, useContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import RouterABI from '../../../../assets/abis/Router.json';
import { ALOE_II_ROUTER_ADDRESS } from '../../../../data/constants/Addresses';
import useAllowance from '../../../../data/hooks/UseAllowance';
import useAllowanceWrite from '../../../../data/hooks/UseAllowanceWrite';
import { Kitty } from '../../../../data/Kitty';
import { Token } from '../../../../data/Token';
import { toBig } from '../../../../util/Numbers';
import { DashedDivider, LABEL_TEXT_COLOR, MODAL_BLACK_TEXT_COLOR, VALUE_TEXT_COLOR } from '../../../common/Modal';
import TokenAmountInput from '../../../common/TokenAmountInput';

const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  APPROVE_ASSET,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.ticker}`,
        enabled: false,
      };
    case ConfirmButtonState.APPROVE_ASSET:
      return {
        text: `Approve ${token.ticker}`,
        enabled: true,
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

export type DepositModalContentProps = {
  token: Token;
  kitty: Kitty;
  setPendingTxnResult: (result: SendTransactionResult) => void;
};

export default function DepositModalContent(props: DepositModalContentProps) {
  const { token, kitty, setPendingTxnResult } = props;
  const { activeChain } = useContext(ChainContext);

  const [depositAmount, setDepositAmount] = useState('');
  const [isPending, setIsPending] = useState(false);
  const account = useAccount();

  const { refetch: refetchBalance, data: depositBalance } = useBalance({
    address: account?.address ?? '0x',
    token: token.address,
    enabled: account.address !== undefined,
    chainId: activeChain.id,
  });

  const { refetch: refetchUserAllowance, data: userAllowanceToken } = useAllowance(
    activeChain,
    token,
    account?.address ?? '0x',
    ALOE_II_ROUTER_ADDRESS
  );

  const writeAllowanceToken = useAllowanceWrite(activeChain, token, ALOE_II_ROUTER_ADDRESS);

  const {
    write: contractWrite,
    isSuccess: contractDidSucceed,
    isLoading: contractIsLoading,
    data: contractData,
  } = useContractWrite({
    address: ALOE_II_ROUTER_ADDRESS,
    abi: RouterABI,
    mode: 'recklesslyUnprepared',
    functionName: 'depositWithApprove(address,uint256)',
    chainId: activeChain.id,
  });

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    interval = setInterval(() => {
      refetchBalance();
      refetchUserAllowance();
    }, 13_000);
    return () => {
      if (interval != null) {
        clearInterval(interval);
      }
    };
  }, [refetchBalance, refetchUserAllowance]);

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxnResult(contractData);
      setIsPending(false);
    } else if (!contractIsLoading && !contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractIsLoading, setIsPending, setPendingTxnResult]);

  const numericDepositBalance = Number(depositBalance?.formatted ?? 0) || 0;
  const numericDepositAmount = Number(depositAmount) || 0;

  const loadingApproval = numericDepositBalance > 0 && !userAllowanceToken;
  const needsApproval =
    userAllowanceToken && toBig(userAllowanceToken).div(token.decimals).toNumber() < numericDepositBalance;

  let confirmButtonState = ConfirmButtonState.READY;

  if (numericDepositAmount > numericDepositBalance) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (loadingApproval) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (needsApproval && isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (needsApproval) {
    confirmButtonState = ConfirmButtonState.APPROVE_ASSET;
  } else if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  function handleClickConfirm() {
    // TODO: Do not use setStates in async functions outside of useEffect
    switch (confirmButtonState) {
      case ConfirmButtonState.APPROVE_ASSET:
        setIsPending(true);
        writeAllowanceToken
          .writeAsync?.()
          .then((txnResult) => {
            txnResult.wait(1).then(() => {
              setIsPending(false);
            });
          })
          .catch((error) => {
            setIsPending(false);
          });
        break;
      case ConfirmButtonState.READY:
        setIsPending(true);
        contractWrite?.({
          recklesslySetUnpreparedArgs: [
            kitty.address,
            ethers.utils.parseUnits(depositAmount, token.decimals).toString(),
          ],
          recklesslySetUnpreparedOverrides: { gasLimit: BigNumber.from('600000') },
        });
        break;
      default:
        break;
    }
  }

  const isDepositAmountValid = numericDepositAmount > 0;
  const shouldConfirmButtonBeDisabled =
    !confirmButton.enabled || (confirmButtonState !== ConfirmButtonState.APPROVE_ASSET && !isDepositAmountValid);

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
          {depositAmount || 0} {token?.ticker}
        </Text>
      </div>
      <div className='w-full ml-auto'>
        <FilledStylizedButton
          size='M'
          fillWidth={true}
          color={MODAL_BLACK_TEXT_COLOR}
          onClick={handleClickConfirm}
          disabled={shouldConfirmButtonBeDisabled}
        >
          {confirmButton.text}
        </FilledStylizedButton>
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
