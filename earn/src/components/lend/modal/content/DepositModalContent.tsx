import { SendTransactionResult } from '@wagmi/core';
import { ethers } from 'ethers';
import { ReactElement, useState } from 'react';
import { useAccount, useBalance, useContractWrite, useNetwork } from 'wagmi';
import KittyABI from '../../../../assets/abis/Kitty.json';
import { ReactComponent as AlertTriangleIcon } from '../../../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../../../assets/svg/check_black.svg';
import { ReactComponent as MoreIcon } from '../../../../assets/svg/more_ellipses.svg';
import { DEFAULT_CHAIN } from '../../../../data/constants/Values';
import useAllowance from '../../../../data/hooks/UseAllowance';
import useAllowanceWrite from '../../../../data/hooks/UseAllowanceWrite';
import { TokenData } from '../../../../data/TokenData';
import { toBig } from '../../../../util/Numbers';
import { FilledStylizedButtonWithIcon } from '../../../common/Buttons';
import {
  DashedDivider,
  LABEL_TEXT_COLOR,
  MODAL_BLACK_TEXT_COLOR,
  VALUE_TEXT_COLOR,
} from '../../../common/Modal';
import TokenAmountInput from '../../../common/TokenAmountInput';
import { Text } from '../../../common/Typography';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  APPROVE_ASSET,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(
  state: ConfirmButtonState,
  token: TokenData,
  kitty: TokenData
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
  token: TokenData;
  kitty: TokenData;
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

  const { data: userAllowanceToken } = useAllowance(
    token,
    account?.address ?? '',
    kitty.address
  );

  const writeAllowanceToken = useAllowanceWrite(
    network?.chain ?? DEFAULT_CHAIN,
    token,
    kitty.address
  );

  const contract = useContractWrite({
    addressOrName: kitty.address,
    contractInterface: KittyABI,
    mode: 'recklesslyUnprepared',
    functionName: 'deposit',
  });

  const numericDepositBalance = Number(depositBalance?.formatted ?? 0) || 0;
  const numericDepositAmount = Number(depositAmount) || 0;

  const loadingApproval = numericDepositBalance > 0 && !userAllowanceToken;
  const needsApproval =
    userAllowanceToken &&
    toBig(userAllowanceToken).div(token.decimals).toNumber() <
      numericDepositBalance;

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
          .writeAsync()
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
        contract
          .writeAsync({
            recklesslySetUnpreparedArgs: [
              ethers.utils.parseUnits(depositAmount, token.decimals).toString(),
            ],
            recklesslySetUnpreparedOverrides: {
              gasLimit: (600000).toFixed(0),
            },
          })
          .then((txnResult) => {
            setPendingTxnResult(txnResult);
          })
          .catch((error) => {
            setIsPending(false);
          });
        break;
      default:
        break;
    }
  }

  const isDepositAmountValid = numericDepositAmount > 0;
  const shouldConfirmButtonBeDisabled =
    !confirmButton.enabled ||
    (confirmButtonState !== ConfirmButtonState.APPROVE_ASSET &&
      !isDepositAmountValid);

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
          {depositAmount || 0} {kitty?.ticker}
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
