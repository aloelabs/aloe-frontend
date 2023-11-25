import { useContext, useMemo, useState } from 'react';

import { Address, SendTransactionResult } from '@wagmi/core';
import { ethers } from 'ethers';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import {
  DashedDivider,
  LABEL_TEXT_COLOR,
  MODAL_BLACK_TEXT_COLOR,
  VALUE_TEXT_COLOR,
} from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import {
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS,
  ALOE_II_FACTORY_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { useAccount, useBalance, useContractRead, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import { isSolvent, maxBorrowAndWithdraw } from '../../../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../../../data/BorrowerNft';
import { Liabilities } from '../../../../data/MarginAccount';
import { MarketInfo } from '../../../../data/MarketInfo';

const GAS_ESTIMATE_WIGGLE_ROOM = 110;
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  PENDING,
  READY,
  UNHEALTHY,
  NOT_ENOUGH_SUPPLY,
  WAITING_FOR_USER,
  LOADING,
  DISABLED,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.UNHEALTHY:
      return { text: 'Insufficient Collateral', enabled: false };
    case ConfirmButtonState.NOT_ENOUGH_SUPPLY:
      return { text: `Not Enough ${token.symbol} Supply`, enabled: false };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading...', enabled: false };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type ConfirmButtonProps = {
  borrowAmount: GN;
  borrower: BorrowerNftBorrower;
  isLoading: boolean;
  isUnhealthy: boolean;
  notEnoughSupply: boolean;
  requiredAnte?: GN;
  token: Token;
  isBorrowingToken0: boolean;
  accountAddress?: Address;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function ConfirmButton(props: ConfirmButtonProps) {
  const {
    borrowAmount,
    borrower,
    isLoading,
    isUnhealthy,
    notEnoughSupply,
    requiredAnte,
    token,
    isBorrowingToken0,
    accountAddress,
    setPendingTxn,
  } = props;
  const { activeChain } = useContext(ChainContext);

  const encodedBorrowCall = useMemo(() => {
    if (!accountAddress) return null;
    const borrowerInterface = new ethers.utils.Interface(borrowerAbi);
    const amount0 = isBorrowingToken0 ? borrowAmount : GN.zero(borrower.token0.decimals);
    const amount1 = isBorrowingToken0 ? GN.zero(borrower.token1.decimals) : borrowAmount;

    return borrowerInterface.encodeFunctionData('borrow', [
      amount0.toBigNumber(),
      amount1.toBigNumber(),
      accountAddress,
    ]) as `0x${string}`;
  }, [borrowAmount, borrower.token0.decimals, borrower.token1.decimals, isBorrowingToken0, accountAddress]);

  const { config: borrowConfig, isLoading: isCheckingIfAbleToBorrow } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      accountAddress ?? '0x',
      [borrower.index],
      [ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS[activeChain.id]],
      [encodedBorrowCall ?? '0x'],
      [requiredAnte?.toBigNumber().div(1e13).toNumber() ?? 0],
    ],
    overrides: { value: requiredAnte?.toBigNumber() },
    chainId: activeChain.id,
    enabled:
      accountAddress && encodedBorrowCall != null && requiredAnte !== undefined && !isUnhealthy && !notEnoughSupply,
  });
  const gasLimit = borrowConfig.request?.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100);
  const { write: borrow, isLoading: isAskingUserToConfirm } = useContractWrite({
    ...borrowConfig,
    request: {
      ...borrowConfig.request,
      gasLimit,
    },
    onSuccess(data) {
      setPendingTxn(data);
    },
  });

  let confirmButtonState: ConfirmButtonState = ConfirmButtonState.READY;

  if (isLoading) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (isAskingUserToConfirm) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_USER;
  } else if (borrowAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else if (isUnhealthy) {
    confirmButtonState = ConfirmButtonState.UNHEALTHY;
  } else if (notEnoughSupply) {
    confirmButtonState = ConfirmButtonState.NOT_ENOUGH_SUPPLY;
  } else if (isCheckingIfAbleToBorrow && !borrowConfig.request) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (!borrowConfig.request) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      color={MODAL_BLACK_TEXT_COLOR}
      onClick={() => borrow?.()}
      disabled={!confirmButton.enabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type BorrowModalContentProps = {
  borrower: BorrowerNftBorrower;
  marketInfo?: MarketInfo;
  setPendingTxnResult: (result: SendTransactionResult | null) => void;
};

export default function BorrowModalContent(props: BorrowModalContentProps) {
  const { borrower, marketInfo, setPendingTxnResult } = props;

  const [additionalBorrowAmountStr, setAdditionalBorrowAmountStr] = useState('');

  const { address: accountAddress } = useAccount();
  const { activeChain } = useContext(ChainContext);

  const { data: anteData } = useContractRead({
    abi: factoryAbi,
    address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
    functionName: 'getParameters',
    args: [borrower.uniswapPool as Address],
    chainId: activeChain.id,
  });

  const ante = useMemo(() => {
    if (!anteData) return GN.zero(18);
    return GN.fromBigNumber(anteData[0], 18);
  }, [anteData]);

  const { data: accountEtherBalanceResult } = useBalance({
    address: borrower.address as Address,
    chainId: activeChain.id,
    watch: false,
  });

  const accountEtherBalance = accountEtherBalanceResult && GN.fromBigNumber(accountEtherBalanceResult.value, 18);

  // TODO: This assumes that the borrowing token is always the opposite of the collateral token
  // and that only one token is borrowed and one token is collateralized
  const isBorrowingToken0 = borrower.assets.token1Raw > 0;

  // TODO: This logic needs to change once we support more complex borrowing
  const borrowToken = isBorrowingToken0 ? borrower.token0 : borrower.token1;
  // TODO: This assumes that the borrowing token is always the opposite of the collateral token
  // and that only one token is borrowed and one token is collateralized
  const numericExistingLiability = isBorrowingToken0 ? borrower.liabilities.amount0 : borrower.liabilities.amount1;
  const existingLiability = GN.fromNumber(numericExistingLiability, borrowToken.decimals);
  const borrowAmount = GN.fromDecimalString(additionalBorrowAmountStr || '0', borrowToken.decimals);
  const newLiability = existingLiability.add(borrowAmount);

  const requiredAnte =
    accountEtherBalance !== undefined && accountEtherBalance.lt(ante) ? ante.sub(accountEtherBalance) : GN.zero(18);

  const maxBorrowsBasedOnMarket = isBorrowingToken0
    ? marketInfo?.lender0AvailableAssets
    : marketInfo?.lender1AvailableAssets;

  // TODO: use GN
  const maxBorrowsBasedOnHealth = maxBorrowAndWithdraw(
    borrower.assets,
    borrower.liabilities,
    [], // TODO: add uniswap positions
    borrower.sqrtPriceX96,
    borrower.iv,
    borrower.nSigma,
    borrower.token0.decimals,
    borrower.token1.decimals
  )[isBorrowingToken0 ? 0 : 1];

  // TODO: use GN
  const max = Math.min(maxBorrowsBasedOnHealth, maxBorrowsBasedOnMarket?.toNumber() ?? 0);

  // Mitigate the case when the number is represented in scientific notation
  const gnEightyPercentMax = GN.fromNumber(max, borrowToken.decimals).recklessMul(80).recklessDiv(100);
  const maxString = gnEightyPercentMax.toString(GNFormat.DECIMAL);

  // TODO: use GN
  const newLiabilities: Liabilities = {
    amount0: isBorrowingToken0 ? newLiability.toNumber() : borrower.liabilities.amount0,
    amount1: isBorrowingToken0 ? borrower.liabilities.amount1 : newLiability.toNumber(),
  };

  const { health: newHealth } = isSolvent(
    borrower.assets,
    newLiabilities,
    [], // TODO: add uniswap positions
    borrower.sqrtPriceX96,
    borrower.iv,
    borrower.nSigma,
    borrower.token0.decimals,
    borrower.token1.decimals
  );

  // A user is considered unhealthy if their health is 1 or less
  const isUnhealthy = newHealth <= 1;
  // A user cannot borrow more than the total supply of the market
  const notEnoughSupply = maxBorrowsBasedOnMarket?.lt(borrowAmount) ?? false;

  return (
    <>
      <div className='flex justify-between items-center mb-4'>
        <TokenAmountInput
          token={borrowToken}
          onChange={(updatedAmount: string) => {
            setAdditionalBorrowAmountStr(updatedAmount);
          }}
          value={additionalBorrowAmountStr}
          max={maxString}
          maxed={additionalBorrowAmountStr === maxString}
        />
      </div>
      <div className='flex justify-between items-center mb-8'>
        <Text size='S' weight='medium' color={LABEL_TEXT_COLOR}>
          Updated Borrowed Amount
        </Text>
        <DashedDivider />
        <Text size='L' weight='medium' color={VALUE_TEXT_COLOR}>
          {newLiability.toString(GNFormat.LOSSY_HUMAN)} {borrowToken.symbol}
        </Text>
      </div>
      <div className='w-full ml-auto'>
        <ConfirmButton
          borrowAmount={borrowAmount}
          borrower={borrower}
          isLoading={marketInfo === undefined}
          isUnhealthy={isUnhealthy}
          notEnoughSupply={notEnoughSupply}
          requiredAnte={requiredAnte}
          token={borrowToken}
          isBorrowingToken0={isBorrowingToken0}
          accountAddress={accountAddress}
          setPendingTxn={setPendingTxnResult}
        />
      </div>
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By borrowing, you agree to our{' '}
        <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </>
  );
}
