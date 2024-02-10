import { useContext, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber, ethers } from 'ethers';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { permit2Abi } from 'shared/lib/abis/Permit2';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_PERMIT2_MANAGER_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Permit2State, usePermit2 } from 'shared/lib/data/hooks/UsePermit2';
import { Token } from 'shared/lib/data/Token';
import { useAccount, useBalance } from 'wagmi';

import { ChainContext } from '../../../../App';
import { isHealthy } from '../../../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../../../data/BorrowerNft';
import { Assets } from '../../../../data/MarginAccount';
import MulticallOperator from '../../../../data/operations/MulticallOperator';
import HealthBar from '../../../borrow/HealthBar';

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
      return { text: 'Add Action', enabled: true };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Add Action', enabled: false };
  }
}

type ConfirmButtonProps = {
  depositAmount: GN;
  maxDepositAmount: GN;
  borrower: BorrowerNftBorrower;
  token: Token;
  isDepositingToken0: boolean;
  multicallOperator: MulticallOperator;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function ConfirmButton(props: ConfirmButtonProps) {
  const { depositAmount, maxDepositAmount, borrower, token, isDepositingToken0, multicallOperator, setIsOpen } = props;
  const { address: accountAddress } = useAccount();
  const { activeChain } = useContext(ChainContext);

  const {
    state: permit2State,
    action: permit2Action,
    result: permit2Result,
  } = usePermit2(
    activeChain,
    token,
    accountAddress ?? '0x',
    ALOE_II_PERMIT2_MANAGER_ADDRESS[activeChain.id],
    depositAmount
  );

  const encodedPermit2 = useMemo(() => {
    if (!accountAddress || !permit2Result.signature) return null;
    const permit2 = new ethers.utils.Interface(permit2Abi);
    return permit2.encodeFunctionData(
      'permitTransferFrom(((address,uint256),uint256,uint256),(address,uint256),address,bytes)',
      [
        {
          permitted: {
            token: token.address,
            amount: permit2Result.amount.toBigNumber(),
          },
          nonce: BigNumber.from(permit2Result.nonce ?? '0'),
          deadline: BigNumber.from(permit2Result.deadline),
        },
        {
          to: borrower.address,
          requestedAmount: permit2Result.amount.toBigNumber(),
        },
        accountAddress,
        permit2Result.signature,
      ]
    );
  }, [permit2Result, token, accountAddress, borrower.address]);

  const encodedDepositCall = useMemo(() => {
    const borrowerInterface = new ethers.utils.Interface(borrowerAbi);
    const amount0 = isDepositingToken0 ? depositAmount : GN.zero(borrower.token0.decimals);
    const amount1 = isDepositingToken0 ? GN.zero(borrower.token1.decimals) : depositAmount;

    return borrowerInterface.encodeFunctionData('transfer', [
      amount0.toBigNumber(),
      amount1.toBigNumber(),
      borrower.address,
    ]) as `0x${string}`;
  }, [isDepositingToken0, depositAmount, borrower.token0.decimals, borrower.token1.decimals, borrower.address]);

  let confirmButtonState: ConfirmButtonState = ConfirmButtonState.READY;

  if (depositAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else if (depositAmount.gt(maxDepositAmount)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  return (
    <div className='flex flex-col gap-4 w-full'>
      <FilledStylizedButton
        size='M'
        fillWidth={true}
        disabled={!confirmButton.enabled}
        onClick={() => {
          if (permit2State !== Permit2State.DONE) {
            permit2Action?.();
            return;
          }
          if (!accountAddress || encodedPermit2 == null || encodedDepositCall == null) return;
          multicallOperator.addModifyOperation({
            owner: accountAddress,
            indices: [borrower.index],
            managers: [ALOE_II_PERMIT2_MANAGER_ADDRESS[activeChain.id]],
            data: [encodedPermit2.concat(encodedDepositCall.slice(2)) as `0x${string}`],
            antes: [GN.zero(18)],
          });
          setIsOpen(false);
        }}
      >
        {confirmButton.text}
      </FilledStylizedButton>
    </div>
  );
}

export type AddCollateralModalContentProps = {
  borrower: BorrowerNftBorrower;
  multicallOperator: MulticallOperator;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxnResult: (result: SendTransactionResult | null) => void;
};

export default function AddCollateralModalContent(props: AddCollateralModalContentProps) {
  const { borrower, multicallOperator, setIsOpen, setPendingTxnResult } = props;

  const [depositAmountStr, setDepositAmountStr] = useState('');
  const { activeChain } = useContext(ChainContext);

  const { address: userAddress } = useAccount();

  // TODO this logic needs to change once we support more complex borrowing
  const isDepositingToken0 = borrower.assets.token0Raw > 0;

  const { data: balanceData } = useBalance({
    address: userAddress,
    token: isDepositingToken0 ? borrower.token0.address : borrower.token1.address,
    enabled: userAddress !== undefined,
    chainId: activeChain.id,
  });

  // TODO: This logic needs to change once we support more complex borrowing
  const collateralToken = isDepositingToken0 ? borrower.token0 : borrower.token1;
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
          isDepositingToken0={isDepositingToken0}
          multicallOperator={multicallOperator}
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
