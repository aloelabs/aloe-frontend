import { useContext, useState, useMemo, useEffect } from 'react';

import { Address, SendTransactionResult } from '@wagmi/core';
import { ethers } from 'ethers';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { CustomMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Display, Text } from 'shared/lib/components/common/Typography';
import {
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS,
  ALOE_II_FACTORY_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput, truncateDecimals } from 'shared/lib/util/Numbers';
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import { isHealthy, maxBorrowAndWithdraw } from '../../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../../data/BorrowerNft';
import { LendingPair } from '../../../data/LendingPair';
import { Liabilities } from '../../../data/MarginAccount';
import HealthBar from '../../common/HealthBar';
import TokenAmountSelectInput from '../../portfolio/TokenAmountSelectInput';

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
  borrower: BorrowerNftBorrower;
  etherToSend: GN;
  userAddress: Address;
  borrowToken: Token;
  borrowAmount: GN;
  isUnhealthy: boolean;
  notEnoughSupply: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: SendTransactionResult | null) => void;
};

function BorrowButton(props: BorrowButtonProps) {
  const {
    borrower,
    etherToSend,
    userAddress,
    borrowToken,
    borrowAmount,
    isUnhealthy,
    notEnoughSupply,
    setIsOpen,
    setPendingTxn,
  } = props;
  const { activeChain } = useContext(ChainContext);

  const [isPending, setIsPending] = useState(false);

  const isBorrowingToken0 = borrowToken.address === borrower.token0.address;

  const amount0Big = isBorrowingToken0 ? borrowAmount : GN.zero(borrowToken.decimals);
  const amount1Big = isBorrowingToken0 ? GN.zero(borrowToken.decimals) : borrowAmount;

  const borrowerInterface = new ethers.utils.Interface(borrowerAbi);
  const encodedData = borrowerInterface.encodeFunctionData('borrow', [
    amount0Big.toBigNumber(),
    amount1Big.toBigNumber(),
    userAddress,
  ]);

  const { config: borrowConfig, isLoading: prepareContractIsLoading } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      userAddress,
      [borrower.index],
      [ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS[activeChain.id]],
      [encodedData as `0x${string}`],
      [etherToSend.toBigNumber().div(1e13).toNumber()],
    ],
    overrides: { value: etherToSend.toBigNumber() },
    enabled: Boolean(userAddress) && borrowAmount.isGtZero() && !isUnhealthy && !notEnoughSupply,
    chainId: activeChain.id,
  });
  const borrowUpdatedRequest = useMemo(() => {
    if (borrowConfig.request) {
      return {
        ...borrowConfig.request,
        gasLimit: borrowConfig.request.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100),
      };
    }
    return undefined;
  }, [borrowConfig.request]);
  const {
    write: contractWrite,
    isSuccess: contractDidSucceed,
    isLoading: contractIsLoading,
    data: contractData,
  } = useContractWrite({
    ...borrowConfig,
    request: borrowUpdatedRequest,
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
  } else if (prepareContractIsLoading && !borrowConfig.request) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (!borrowConfig.request) {
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
  borrower: BorrowerNftBorrower;
  market: LendingPair;
  accountEtherBalance?: GN;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function BorrowModal(props: BorrowModalProps) {
  const { borrower, market, accountEtherBalance, isOpen, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);

  const [borrowAmountStr, setBorrowAmountStr] = useState('');
  const [borrowToken, setBorrowToken] = useState<Token>(borrower.token0);

  const { address: userAddress } = useAccount();

  // Reset borrow amount and token when modal is opened/closed
  // or when the margin account token0 changes
  useEffect(() => {
    setBorrowAmountStr('');
    setBorrowToken(borrower.token0);
  }, [isOpen, borrower.token0]);

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

  const tokenOptions = [borrower.token0, borrower.token1];
  const isToken0 = borrowToken.address === borrower.token0.address;

  const numericExistingLiability = isToken0 ? borrower.liabilities.amount0 : borrower.liabilities.amount1;
  const borrowAmount = GN.fromDecimalString(borrowAmountStr || '0', borrowToken.decimals);
  const existingLiability = GN.fromNumber(numericExistingLiability, borrowToken.decimals);

  const newLiability = existingLiability.add(borrowAmount);

  let etherToSend = GN.zero(18, 10);
  if (accountEtherBalance !== undefined && accountEtherBalance.lt(ante)) {
    etherToSend = ante.sub(accountEtherBalance);
  }

  if (!userAddress || !isOpen) {
    return null;
  }

  // TODO: use GN
  const maxBorrowsBasedOnHealth = maxBorrowAndWithdraw(
    borrower.assets,
    borrower.liabilities,
    borrower.sqrtPriceX96,
    borrower.iv,
    borrower.nSigma,
    borrower.token0.decimals,
    borrower.token1.decimals
  )[isToken0 ? 0 : 1];

  const max = Math.min(
    maxBorrowsBasedOnHealth,
    market[isToken0 ? 'kitty0Info' : 'kitty1Info'].availableAssets.toNumber()
  );
  // Mitigate the case when the number is represented in scientific notation
  const gnEightyPercentMax = GN.fromNumber(max, borrowToken.decimals).recklessMul(80).recklessDiv(100);
  const maxString = gnEightyPercentMax.toString(GNFormat.DECIMAL);

  // TODO: use GN
  const newLiabilities: Liabilities = {
    amount0: isToken0 ? newLiability.toNumber() : borrower.liabilities.amount0,
    amount1: isToken0 ? borrower.liabilities.amount1 : newLiability.toNumber(),
  };

  const { health: newHealth } = isHealthy(
    borrower.assets,
    newLiabilities,
    borrower.sqrtPriceX96,
    borrower.iv,
    borrower.nSigma,
    borrower.token0.decimals,
    borrower.token1.decimals
  );

  const apr = market[isToken0 ? 'kitty0Info' : 'kitty1Info'].hypotheticalBorrowAPR(borrowAmount) * 100;

  // A user is considered unhealthy if their health is 1 or less
  const isUnhealthy = newHealth <= 1;
  // A user cannot borrow more than the total supply of the market
  const notEnoughSupply = borrowAmount.gt(market[isToken0 ? 'kitty0Info' : 'kitty1Info'].availableAssets);

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
              {borrower.token0.symbol}/{borrower.token1.symbol}
            </strong>{' '}
            smart wallet. Your total borrows for this token in this smart wallet will be{' '}
            <strong>
              {newLiability.toString(GNFormat.DECIMAL)} {borrowToken.symbol}
            </strong>
            .
          </Text>
          {etherToSend.isGtZero() && (
            <Text size='XS' color={TERTIARY_COLOR} className='overflow-hidden text-ellipsis'>
              You will need to provide an additional {etherToSend.toString(GNFormat.DECIMAL)} ETH to cover the gas fees
              in the event that you are liquidated.
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
            borrower={borrower}
            etherToSend={etherToSend}
            userAddress={userAddress}
            borrowToken={borrowToken}
            borrowAmount={borrowAmount}
            isUnhealthy={isUnhealthy}
            notEnoughSupply={notEnoughSupply}
            setIsOpen={setIsOpen}
            setPendingTxn={setPendingTxn}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By using our service, you agree to our{' '}
            <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
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
