import { SendTransactionResult } from '@wagmi/core';
import { ethers } from 'ethers';
import { ReactElement, useState } from 'react';
import { useAccount, useContractWrite } from 'wagmi';
import KittyABI from '../../../../assets/abis/Kitty.json';
import { ReactComponent as AlertTriangleIcon } from '../../../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../../../assets/svg/check_black.svg';
import { ReactComponent as MoreIcon } from '../../../../assets/svg/more_ellipses.svg';
import { useAmountToShares } from '../../../../data/hooks/UseAmountToShares';
import { useBalanceOfUnderlying } from '../../../../data/hooks/UseUnderlyingBalanceOf';
import { TokenData } from '../../../../data/TokenData';
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
  INSUFFICIENT_KITTY,
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
    case ConfirmButtonState.INSUFFICIENT_KITTY:
      return {
        text: `Insufficient ${kitty.ticker}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
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

export type WithdrawModalContentProps = {
  token: TokenData;
  kitty: TokenData;
  setPendingTxnResult: (result: SendTransactionResult) => void;
};

export default function WithdrawModalContent(props: WithdrawModalContentProps) {
  const { token, kitty, setPendingTxnResult } = props;

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isPending, setIsPending] = useState(false);

  const { address: accountAddress } = useAccount();

  const contract = useContractWrite({
    addressOrName: kitty.address,
    contractInterface: KittyABI,
    mode: 'recklesslyUnprepared',
    functionName: 'withdraw',
  });

  const balanceOfUnderlying = useBalanceOfUnderlying(token, kitty, accountAddress || '');
  const amountToShares = useAmountToShares(token, kitty, withdrawAmount);
  
  const sharesToWithdraw = amountToShares ?? '0';
  const underlyingBalance = balanceOfUnderlying ?? '0';

  const numericWithdrawAmount = Number(withdrawAmount) || 0;
  const numericWithdrawBalance = parseFloat(underlyingBalance);

  let confirmButtonState = ConfirmButtonState.READY;

  if (numericWithdrawAmount > numericWithdrawBalance) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_KITTY;
  } else if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token, kitty);

  function handleClickConfirm() {
    // TODO: Do not use setStates in async functions outside of useEffect
    switch (confirmButtonState) {
      case ConfirmButtonState.READY:
        setIsPending(true);
        contract
          .writeAsync({
            recklesslySetUnpreparedArgs: [
              ethers.utils
                .parseUnits(sharesToWithdraw.toString(), token.decimals)
                .toString(),
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

  return (
    <>
      <div className='flex justify-between items-center mb-4'>
        <TokenAmountInput
          tokenLabel={token?.ticker || ''}
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
          {sharesToWithdraw} {token?.ticker}
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
          disabled={!confirmButton.enabled || numericWithdrawAmount === 0}
        >
          {confirmButton.text}
        </FilledStylizedButtonWithIcon>
      </div>
    </>
  );
}
