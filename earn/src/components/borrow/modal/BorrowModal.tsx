import { useContext, useState, useMemo, useEffect } from 'react';

import { Address, SendTransactionResult } from '@wagmi/core';
import Big from 'big.js';
import { BigNumber, ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput, truncateDecimals } from 'shared/lib/util/Numbers';
import { useAccount, useBalance, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import MarginAccountABI from '../../../assets/abis/MarginAccount.json';
import { isSolvent, maxBorrowAndWithdraw } from '../../../data/BalanceSheet';
import { ALOE_II_SIMPLE_MANAGER_ADDRESS } from '../../../data/constants/Addresses';
import { ANTE } from '../../../data/constants/Values';
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
      return { text: `Not Enough ${token.ticker} Supply`, enabled: false };
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
  borrowAmount: Big;
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

  const isBorrowingToken0 = borrowToken.address === marginAccount.token0.address;

  const amount0Big = isBorrowingToken0 ? borrowAmount : new Big(0);
  const amount1Big = isBorrowingToken0 ? new Big(0) : borrowAmount;

  const marginAccountInterface = new ethers.utils.Interface(MarginAccountABI);
  const encodedData = marginAccountInterface.encodeFunctionData('borrow', [
    amount0Big.toFixed(),
    amount1Big.toFixed(),
    userAddress,
  ]);

  const { config: removeCollateralConfig, isLoading: prepareContractIsLoading } = usePrepareContractWrite({
    address: marginAccount.address,
    abi: MarginAccountABI,
    functionName: 'modify',
    args: [ALOE_II_SIMPLE_MANAGER_ADDRESS, encodedData, [false, false]],
    overrides: { value: shouldProvideAnte ? ANTE + 1 : undefined },
    enabled: !!userAddress && borrowAmount.gt(0) && !isUnhealthy && !notEnoughSupply,
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

  const [borrowAmount, setBorrowAmount] = useState('');
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
    setBorrowAmount('');
    setBorrowToken(marginAccount.token0);
  }, [isOpen, marginAccount.token0]);

  const tokenOptions = [marginAccount.token0, marginAccount.token1];
  const isToken0 = borrowToken.address === marginAccount.token0.address;

  const numericBorrowAmount = Number(borrowAmount) || 0;
  const numericExistingLiability = isToken0 ? marginAccount.liabilities.amount0 : marginAccount.liabilities.amount1;
  const borrowAmountBig = new Big(numericBorrowAmount).mul(10 ** borrowToken.decimals);
  const existingLiabilityBig = new Big(numericExistingLiability).mul(10 ** borrowToken.decimals);

  const newLiability = existingLiabilityBig.plus(borrowAmountBig).div(10 ** borrowToken.decimals);

  const shouldProvideAnte = (accountEtherBalance && accountEtherBalance.value.lt(ANTE.toFixed(0))) || false;

  const formattedAnte = new Big(ANTE).div(10 ** 18).toFixed(4);

  if (!userAddress || !isOpen) {
    return null;
  }

  const maxBorrowsBasedOnMarketBig = isToken0 ? marketInfo.lender0AvailableAssets : marketInfo.lender1AvailableAssets;
  const maxBorrowsBasedOnMarket = maxBorrowsBasedOnMarketBig.div(10 ** borrowToken.decimals).toNumber();
  const maxBorrowsBasedOnHealth = maxBorrowAndWithdraw(
    marginAccount.assets,
    marginAccount.liabilities,
    uniswapPositions,
    marginAccount.sqrtPriceX96,
    marginAccount.iv,
    marginAccount.token0.decimals,
    marginAccount.token1.decimals
  )[isToken0 ? 0 : 1];
  const max = Math.min(maxBorrowsBasedOnHealth, maxBorrowsBasedOnMarket);
  // Mitigate the case when the number is represented in scientific notation
  const bigMax = BigNumber.from(new Big(max).mul(10 ** borrowToken.decimals).toFixed(0));
  const maxString = ethers.utils.formatUnits(bigMax, borrowToken.decimals);

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
  const remainingAvailableAssets = availableAssets.sub(borrowAmountBig);

  const lenderTotalAssets = isToken0 ? marketInfo.lender0TotalAssets : marketInfo.lender1TotalAssets;
  const newUtilization = lenderTotalAssets.gt(0) ? 1 - remainingAvailableAssets.div(lenderTotalAssets).toNumber() : 0;
  const apr = yieldPerSecondToAPR(RateModel.computeYieldPerSecond(newUtilization)) * 100;

  // A user is considered unhealthy if their health is 1 or less
  const isUnhealthy = newHealth <= 1;
  // A user cannot borrow more than the total supply of the market
  const notEnoughSupply = maxBorrowsBasedOnMarketBig.lt(borrowAmountBig);

  return (
    <Modal isOpen={isOpen} title='Borrow' setIsOpen={setIsOpen} maxHeight='650px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Borrow Amount
            </Text>
            <BaseMaxButton
              size='L'
              onClick={() => {
                setBorrowAmount(maxString);
              }}
            >
              MAX
            </BaseMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={borrowAmount}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, borrowToken.decimals);
                setBorrowAmount(truncatedOutput);
              }
            }}
            onSelect={(option: Token) => {
              setBorrowAmount('');
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
              {borrowAmount || '0.00'} {borrowToken.ticker}
            </strong>{' '}
            using this{' '}
            <strong>
              {marginAccount.token0.ticker}/{marginAccount.token1.ticker}
            </strong>{' '}
            smart wallet. Your total borrows for this token in this smart wallet will be{' '}
            <strong>
              {truncateDecimals(newLiability.toString(), borrowToken.decimals)} {borrowToken.ticker}
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
            borrowAmount={borrowAmountBig}
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
