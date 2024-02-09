import { useContext, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { erc20Abi } from 'shared/lib/abis/ERC20';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { MODAL_BLACK_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { useAccount, useBalance, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import { isHealthy } from '../../../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../../../data/BorrowerNft';
import { Assets } from '../../../../data/MarginAccount';
import HealthBar from '../../../borrow/HealthBar';

const GAS_ESTIMATE_WIGGLE_ROOM = 110;
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  WAITING_FOR_USER,
  PENDING,
  LOADING,
  DISABLED,
  READY,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.symbol}`,
        enabled: false,
      };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading...', enabled: false };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type ConfirmButtonProps = {
  depositAmount: GN;
  maxDepositAmount: GN;
  borrower: BorrowerNftBorrower;
  token: Token;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function ConfirmButton(props: ConfirmButtonProps) {
  const { depositAmount, maxDepositAmount, borrower, token, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);

  const insufficientAssets = depositAmount.gt(maxDepositAmount);

  const { config: depositConfig, isLoading: isCheckingIfCanDeposit } = usePrepareContractWrite({
    address: token.address,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [borrower.address, depositAmount.toBigNumber()],
    enabled: Boolean(depositAmount) && !insufficientAssets,
    chainId: activeChain.id,
  });
  const gasLimit = depositConfig.request?.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100);
  const { write: deposit, isLoading: isAskingUserToConfirm } = useContractWrite({
    ...depositConfig,
    request: {
      ...depositConfig.request,
      gasLimit,
    },
    onSuccess(data) {
      setIsOpen(false);
      setPendingTxn(data);
    },
  });

  let confirmButtonState: ConfirmButtonState = ConfirmButtonState.READY;

  if (isCheckingIfCanDeposit) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (depositAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else if (depositAmount.gt(maxDepositAmount)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (isAskingUserToConfirm) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_USER;
  } else if (!depositConfig.request) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      color={MODAL_BLACK_TEXT_COLOR}
      onClick={() => deposit?.()}
      disabled={!confirmButton.enabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type AddCollateralModalContentProps = {
  borrower: BorrowerNftBorrower;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxnResult: (result: SendTransactionResult | null) => void;
};

export default function AddCollateralModalContent(props: AddCollateralModalContentProps) {
  const { borrower, setIsOpen, setPendingTxnResult } = props;

  const [depositAmountStr, setDepositAmountStr] = useState('');
  const { activeChain } = useContext(ChainContext);

  const { address: userAddress } = useAccount();

  // TODO this logic needs to change once we support more complex borrowing
  const isDepositingToken0 = borrower.assets.token0Raw > 0;

  // TODO: This logic needs to change once we support more complex borrowing
  const collateralToken = isDepositingToken0 ? borrower.token0 : borrower.token1;

  const { data: balanceData } = useBalance({
    address: userAddress,
    token: collateralToken.address,
    enabled: userAddress !== undefined,
    chainId: activeChain.id,
  });

  // TODO: This assumes that the borrowing token is always the opposite of the collateral token
  // and that only one token is borrowed and one token is collateralized
  const numericCollateralAmount = isDepositingToken0 ? borrower.assets.token0Raw : borrower.assets.token1Raw;
  const currentCollateralAmount = GN.fromNumber(numericCollateralAmount, collateralToken.decimals);
  const depositAmount = GN.fromDecimalString(depositAmountStr || '0', collateralToken.decimals);
  const newCollateralAmount = currentCollateralAmount.add(depositAmount);
  const maxDepositAmount = GN.fromDecimalString(balanceData?.formatted || '0', collateralToken.decimals);
  const maxDepositAmountStr = maxDepositAmount.toString(GNFormat.DECIMAL);

  // TODO: use GN
  const newAssets: Assets = {
    token0Raw: isDepositingToken0 ? newCollateralAmount.toNumber() : borrower.assets.token0Raw,
    token1Raw: isDepositingToken0 ? borrower.assets.token1Raw : newCollateralAmount.toNumber(),
    uni0: 0, // TODO: add uniswap positions
    uni1: 0, // TODO: add uniswap positions
  };

  const { health: newHealth } = isHealthy(
    newAssets,
    borrower.liabilities,
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
          token={collateralToken}
          onChange={(updatedAmount: string) => {
            setDepositAmountStr(updatedAmount);
          }}
          value={depositAmountStr}
          max={maxDepositAmountStr}
          maxed={depositAmountStr === maxDepositAmountStr}
        />
      </div>
      <div className='flex flex-col gap-1 w-full'>
        <Text size='M' weight='bold'>
          Summary
        </Text>
        <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
          You're adding{' '}
          <strong>
            {depositAmountStr || '0.00'} {collateralToken.symbol}
          </strong>{' '}
          collateral to this{' '}
          <strong>
            {borrower.token0.symbol}/{borrower.token1.symbol}
          </strong>{' '}
          smart wallet. Your total collateral for this token in this smart wallet will be{' '}
          <strong>
            {newCollateralAmount.toString(GNFormat.DECIMAL)} {collateralToken.symbol}
          </strong>
          .
        </Text>
        <div className='mt-2'>
          <HealthBar health={newHealth} />
        </div>
      </div>
      <div className='w-full ml-auto mt-8'>
        <ConfirmButton
          depositAmount={depositAmount}
          maxDepositAmount={maxDepositAmount}
          borrower={borrower}
          token={collateralToken}
          setIsOpen={setIsOpen}
          setPendingTxn={setPendingTxnResult}
        />
      </div>
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By depositing, you agree to our{' '}
        <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </>
  );
}
