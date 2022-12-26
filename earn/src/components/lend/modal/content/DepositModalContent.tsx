import { ReactElement, useEffect, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber, ethers } from 'ethers';
import { FilledStylizedButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount, useBalance, useContractWrite, useNetwork } from 'wagmi';

import RouterABI from '../../../../assets/abis/Router.json';
import { ReactComponent as AlertTriangleIcon } from '../../../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../../../assets/svg/check_black.svg';
import { ReactComponent as MoreIcon } from '../../../../assets/svg/more_ellipses.svg';
import { ALOE_II_ROUTER_ADDRESS } from '../../../../data/constants/Addresses';
import { DEFAULT_CHAIN } from '../../../../data/constants/Values';
import useAllowance from '../../../../data/hooks/UseAllowance';
import useAllowanceWrite from '../../../../data/hooks/UseAllowanceWrite';
import { Kitty } from '../../../../data/Kitty';
import { Token } from '../../../../data/Token';
import { toBig } from '../../../../util/Numbers';
import { DashedDivider, LABEL_TEXT_COLOR, MODAL_BLACK_TEXT_COLOR, VALUE_TEXT_COLOR } from '../../../common/Modal';
import TokenAmountInput from '../../../common/TokenAmountInput';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  APPROVE_ASSET,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(
  state: ConfirmButtonState,
  token: Token,
  kitty: Kitty
): { text: string; Icon: ReactElement; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.ticker}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
      };
    case ConfirmButtonState.APPROVE_ASSET:
      return {
        text: `Approve ${token.ticker}`,
        Icon: <CheckIcon />,
        enabled: true,
      };
    case ConfirmButtonState.LOADING:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: false };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', Icon: <MoreIcon />, enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: true };
    default:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: false };
  }
}

export type DepositModalContentProps = {
  token: Token;
  kitty: Kitty;
  setPendingTxnResult: (result: SendTransactionResult) => void;
};

export default function DepositModalContent(props: DepositModalContentProps) {
  const { token, kitty, setPendingTxnResult } = props;

  const [depositAmount, setDepositAmount] = useState('');
  const [isPending, setIsPending] = useState(false);
  const account = useAccount();
  const network = useNetwork();

  const { data: depositBalance } = useBalance({
    addressOrName: account?.address ?? '',
    token: token.address,
    watch: true,
  });

  const { data: userAllowanceToken } = useAllowance(token, account?.address ?? '0x', ALOE_II_ROUTER_ADDRESS);

  const writeAllowanceToken = useAllowanceWrite(network?.chain ?? DEFAULT_CHAIN, token, ALOE_II_ROUTER_ADDRESS);

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
  });

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

  const confirmButton = getConfirmButton(confirmButtonState, token, kitty);

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
          tokenLabel={token?.ticker || ''}
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
      <div className='w-max ml-auto'>
        <FilledStylizedButtonWithIcon
          size='M'
          fillWidth={true}
          color={MODAL_BLACK_TEXT_COLOR}
          onClick={handleClickConfirm}
          Icon={confirmButton.Icon}
          position='trailing'
          svgColorType='stroke'
          disabled={shouldConfirmButtonBeDisabled}
        >
          {confirmButton.text}
        </FilledStylizedButtonWithIcon>
      </div>
    </>
  );
}
