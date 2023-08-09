import { useContext, useState, useMemo, useEffect } from 'react';

import { Address, SendTransactionResult } from '@wagmi/core';
import { ethers } from 'ethers';
import { borrowerABI } from 'shared/lib/abis/Borrower';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { CustomMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { ANTES } from 'shared/lib/data/constants/ChainSpecific';
import { ALOE_II_SIMPLE_MANAGER_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput, truncateDecimals } from 'shared/lib/util/Numbers';
import { useAccount, useBalance, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import { isSolvent, maxBorrowAndWithdraw } from '../../../data/BalanceSheet';
import { Liabilities, MarginAccount } from '../../../data/MarginAccount';
import { MarketInfo } from '../../../data/MarketInfo';
import { RateModel, yieldPerSecondToAPR } from '../../../data/RateModel';
import { UniswapPosition } from '../../../data/Uniswap';
import TokenAmountSelectInput from '../../portfolio/TokenAmountSelectInput';
import HealthBar from '../HealthBar';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  PENDING,
  READY,
  UNHEALTHY,
  NOT_ENOUGH_SUPPLY,
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
    case ConfirmButtonState.LOADING:
      return { text: 'Loading...', enabled: false };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type BorrowButtonProps = {
  marginAccount: MarginAccount;
  userAddress: string;
  borrowToken: Token;
  borrowAmount: GN;
  shouldProvideAnte: boolean;
  isUnhealthy: boolean;
  notEnoughSupply: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: SendTransactionResult | null) => void;
};

function BorrowButton(props: BorrowButtonProps) {
  const {
    marginAccount,
    userAddress,
    borrowToken,
    borrowAmount,
    shouldProvideAnte,
    isUnhealthy,
    notEnoughSupply,
    setIsOpen,
    setPendingTxn,
  } = props;
  const { activeChain } = useContext(ChainContext);

  const [isPending, setIsPending] = useState(false);

  const ante = ANTES[activeChain.id];

  const isBorrowingToken0 = borrowToken.address === marginAccount.token0.address;

  const amount0Big = isBorrowingToken0 ? borrowAmount : GN.zero(borrowToken.decimals);
  const amount1Big = isBorrowingToken0 ? GN.zero(borrowToken.decimals) : borrowAmount;

  const borrowerInterface = new ethers.utils.Interface(borrowerABI);
  const encodedData = borrowerInterface.encodeFunctionData('borrow', [
    amount0Big.toBigNumber(),
    amount1Big.toBigNumber(),
    userAddress,
  ]);

  const { config: removeCollateralConfig, isLoading: prepareContractIsLoading } = usePrepareContractWrite({
    address: marginAccount.address,
    abi: borrowerABI,
    functionName: 'modify',
    args: [ALOE_II_SIMPLE_MANAGER_ADDRESS[activeChain.id], encodedData as Address, [false, false]],
    overrides: { value: shouldProvideAnte ? ante.recklessAdd(1).toBigNumber() : undefined },
    enabled: !!userAddress && borrowAmount.isGtZero() && !isUnhealthy && !notEnoughSupply,
    chainId: activeChain.id,
  });
  const removeCollateralUpdatedRequest = useMemo(() => {
    if (removeCollateralConfig.request) {
      return {
        ...removeCollateralConfig.request,
        gasLimit: removeCollateralConfig.request.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100),
      };
    }
    return undefined;
  }, [removeCollateralConfig.request]);
  const {
    write: contractWrite,
    isSuccess: contractDidSucceed,
    isLoading: contractIsLoading,
    data: contractData,
  } = useContractWrite({
    ...removeCollateralConfig,
    request: removeCollateralUpdatedRequest,
  });

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
      setIsOpen(false);
    } else if (!contractIsLoading && !contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractIsLoading, setPendingTxn, setIsOpen]);

  let confirmButtonState = ConfirmButtonState.READY;
  if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (isUnhealthy) {
    confirmButtonState = ConfirmButtonState.UNHEALTHY;
  } else if (notEnoughSupply) {
    confirmButtonState = ConfirmButtonState.NOT_ENOUGH_SUPPLY;
  } else if (prepareContractIsLoading && !removeCollateralConfig.request) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (!removeCollateralConfig.request) {
    confirmButtonState = ConfirmButtonState.DISABLED;
  }

  const confirmButton = getConfirmButton(confirmButtonState, borrowToken);

  return (
    <FilledStylizedButton
      size='M'
      fillWidth={true}
      disabled={!confirmButton.enabled}
      onClick={() => {
        if (confirmButtonState === ConfirmButtonState.READY) {
          setIsPending(true);
          contractWrite?.();
        }
      }}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type BorrowModalProps = {
  marginAccount: MarginAccount;
  uniswapPositions: readonly UniswapPosition[];
  marketInfo: MarketInfo;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function BorrowModal(props: BorrowModalProps) {
  const { marginAccount, uniswapPositions, marketInfo, isOpen, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);

  const [borrowAmountStr, setBorrowAmountStr] = useState('');
  const [borrowToken, setBorrowToken] = useState<Token>(marginAccount.token0);

  const { address: userAddress } = useAccount();

  const { data: accountEtherBalance } = useBalance({
    address: marginAccount.address as Address,
    chainId: activeChain.id,
    watch: false,
    enabled: isOpen,
  });

  // Reset borrow amount and token when modal is opened/closed
  // or when the margin account token0 changes
  useEffect(() => {
    setBorrowAmountStr('');
    setBorrowToken(marginAccount.token0);
  }, [isOpen, marginAccount.token0]);

  const tokenOptions = [marginAccount.token0, marginAccount.token1];
  const isToken0 = borrowToken.address === marginAccount.token0.address;

  const numericExistingLiability = isToken0 ? marginAccount.liabilities.amount0 : marginAccount.liabilities.amount1;
  const borrowAmount = GN.fromDecimalString(borrowAmountStr || '0', borrowToken.decimals);
  const existingLiability = GN.fromNumber(numericExistingLiability, borrowToken.decimals);

  const newLiability = existingLiability.add(borrowAmount);

  const gnAccountEtherBalance = accountEtherBalance ? GN.fromBigNumber(accountEtherBalance.value, 18) : GN.zero(18);

  const ante = ANTES[activeChain.id];

  const shouldProvideAnte = (accountEtherBalance && gnAccountEtherBalance.lt(ante)) || false;

  // TODO: use GN (this is an odd case where Big may make more sense)
  const formattedAnte = ante.toString(GNFormat.DECIMAL);

  if (!userAddress || !isOpen) {
    return null;
  }

  const gnMaxBorrowsBasedOnMarket = isToken0 ? marketInfo.lender0AvailableAssets : marketInfo.lender1AvailableAssets;
  // TODO: use GN
  const maxBorrowsBasedOnHealth = maxBorrowAndWithdraw(
    marginAccount.assets,
    marginAccount.liabilities,
    uniswapPositions,
    marginAccount.sqrtPriceX96,
    marginAccount.iv,
    marginAccount.token0.decimals,
    marginAccount.token1.decimals
  )[isToken0 ? 0 : 1];
  // TODO: use GN
  const max = Math.min(maxBorrowsBasedOnHealth, gnMaxBorrowsBasedOnMarket.toNumber());
  // Mitigate the case when the number is represented in scientific notation
  const gnEightyPercentMax = GN.fromNumber(max, borrowToken.decimals).recklessMul(80).recklessDiv(100);
  const maxString = gnEightyPercentMax.toString(GNFormat.DECIMAL);

  // TODO: use GN
  const newLiabilities: Liabilities = {
    amount0: isToken0 ? newLiability.toNumber() : marginAccount.liabilities.amount0,
    amount1: isToken0 ? marginAccount.liabilities.amount1 : newLiability.toNumber(),
  };

  const { health: newHealth } = isSolvent(
    marginAccount.assets,
    newLiabilities,
    uniswapPositions,
    marginAccount.sqrtPriceX96,
    marginAccount.iv,
    marginAccount.token0.decimals,
    marginAccount.token1.decimals
  );

  const availableAssets = isToken0 ? marketInfo.lender0AvailableAssets : marketInfo.lender1AvailableAssets;
  const remainingAvailableAssets = availableAssets.sub(borrowAmount);

  const lenderTotalAssets = isToken0 ? marketInfo.lender0TotalAssets : marketInfo.lender1TotalAssets;
  // TODO: use GN
  const newUtilization = lenderTotalAssets.isGtZero()
    ? 1 - remainingAvailableAssets.div(lenderTotalAssets).toNumber()
    : 0;
  const apr = yieldPerSecondToAPR(RateModel.computeYieldPerSecond(newUtilization)) * 100;

  // A user is considered unhealthy if their health is 1 or less
  const isUnhealthy = newHealth <= 1;
  // A user cannot borrow more than the total supply of the market
  const notEnoughSupply = gnMaxBorrowsBasedOnMarket.lt(borrowAmount);

  return (
    <Modal isOpen={isOpen} title='Borrow' setIsOpen={setIsOpen} maxHeight='650px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex flex-row justify-between items-center mb-1'>
            <Text size='M' weight='bold'>
              Borrow Amount
            </Text>
            <CustomMaxButton
              onClick={() => {
                setBorrowAmountStr(maxString);
              }}
            >
              80% MAX
            </CustomMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={borrowAmountStr}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, borrowToken.decimals);
                setBorrowAmountStr(truncatedOutput);
              }
            }}
            onSelect={(option: Token) => {
              setBorrowAmountStr('');
              setBorrowToken(option);
            }}
            options={tokenOptions}
            selectedOption={borrowToken}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're borrowing{' '}
            <strong>
              {borrowAmountStr || '0.00'} {borrowToken.symbol}
            </strong>{' '}
            using this{' '}
            <strong>
              {marginAccount.token0.symbol}/{marginAccount.token1.symbol}
            </strong>{' '}
            smart wallet. Your total borrows for this token in this smart wallet will be{' '}
            <strong>
              {newLiability.toString(GNFormat.DECIMAL)} {borrowToken.symbol}
            </strong>
            .
          </Text>
          {shouldProvideAnte && (
            <Text size='XS' color={TERTIARY_COLOR} className='overflow-hidden text-ellipsis'>
              You will need to provide an additional {formattedAnte} ETH to cover the gas fees in the event that you are
              liquidated.
            </Text>
          )}
          <div className='flex gap-2 mt-2'>
            <Text size='S'>APR:</Text>
            <Display size='XS'>{apr.toFixed(2)}%</Display>
          </div>
          <div className='mt-2'>
            <HealthBar health={newHealth} />
          </div>
        </div>
        <div className='w-full'>
          <BorrowButton
            marginAccount={marginAccount}
            userAddress={userAddress}
            borrowToken={borrowToken}
            borrowAmount={borrowAmount}
            shouldProvideAnte={shouldProvideAnte}
            isUnhealthy={isUnhealthy}
            notEnoughSupply={notEnoughSupply}
            setIsOpen={setIsOpen}
            setPendingTxn={setPendingTxn}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By using our service, you agree to our{' '}
            <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
              Terms of Service
            </a>{' '}
            and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It
            is your duty to educate yourself and be aware of the risks.
          </Text>
        </div>
      </div>
    </Modal>
  );
}
