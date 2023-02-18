import { useContext, useState, useMemo, useEffect } from 'react';

import { Address, SendTransactionResult } from '@wagmi/core';
import Big from 'big.js';
import { ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount, useBalance, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import MarginAccountABI from '../../../assets/abis/MarginAccount.json';
import { ALOE_II_SIMPLE_MANAGER } from '../../../data/constants/Addresses';
import { ANTE } from '../../../data/constants/Values';
import { MarginAccount, MarketInfo } from '../../../data/MarginAccount';
import { Token } from '../../../data/Token';
import { formatNumberInput, truncateDecimals } from '../../../util/Numbers';
import TokenAmountSelectInput from '../../portfolio/TokenAmountSelectInput';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  UNABLE_TO_BORROW,
  PENDING,
  READY,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.UNABLE_TO_BORROW:
      return {
        text: `Unable to borrow ${token.ticker}`,
        enabled: false,
      };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
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
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: SendTransactionResult | null) => void;
};

function BorrowButton(props: BorrowButtonProps) {
  const { marginAccount, userAddress, borrowToken, borrowAmount, shouldProvideAnte, setIsOpen, setPendingTxn } = props;
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

  const { config: removeCollateralConfig } = usePrepareContractWrite({
    address: marginAccount.address,
    abi: MarginAccountABI,
    functionName: 'modify',
    args: [ALOE_II_SIMPLE_MANAGER, encodedData, [false, false]],
    overrides: { value: shouldProvideAnte ? ANTE + 1 : undefined },
    enabled: !!userAddress && borrowAmount.gt(0),
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

  if (false) {
    confirmButtonState = ConfirmButtonState.UNABLE_TO_BORROW;
  } else if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
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
  marketInfo: MarketInfo;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function BorrowModal(props: BorrowModalProps) {
  const { marginAccount, isOpen, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);

  const [borrowAmount, setBorrowAmount] = useState('');
  const [borrowToken, setBorrowToken] = useState<Token>(marginAccount.token0);

  const { address: userAddress } = useAccount();

  const { data: accountEtherBalance } = useBalance({
    address: marginAccount.address as Address,
    chainId: activeChain.id,
  });

  const resetModal = () => {
    setBorrowAmount('');
    setBorrowToken(marginAccount.token0);
  };

  const tokenOptions = [marginAccount.token0, marginAccount.token1];

  const numericBorrowAmount = Number(borrowAmount) || 0;
  const numericExistingLiability =
    borrowToken.address === marginAccount.token0.address
      ? marginAccount.liabilities.amount0
      : marginAccount.liabilities.amount1;
  const borrowAmountBig = new Big(numericBorrowAmount).mul(10 ** borrowToken.decimals);
  const existingLiabilityBig = new Big(numericExistingLiability).mul(10 ** borrowToken.decimals);

  const newLiability = existingLiabilityBig.plus(borrowAmountBig).div(10 ** borrowToken.decimals);

  const shouldProvideAnte = (accountEtherBalance && accountEtherBalance.value.lt(ANTE.toString())) || false;

  const formattedAnte = new Big(ANTE).div(10 ** 18).toFixed(4);

  if (!userAddress || !isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      title='Borrow'
      setIsOpen={(open: boolean) => {
        setIsOpen(open);
        if (!open) {
          resetModal();
        }
      }}
      maxHeight='650px'
    >
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Borrow Amount
          </Text>
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
            smart wallet. Your total liabilities for this token in this smart wallet will be{' '}
            <strong>
              {truncateDecimals(newLiability.toString(), borrowToken.decimals)} {borrowToken.ticker}
            </strong>
            .
          </Text>
          {shouldProvideAnte && (
            <Text size='XS' color={TERTIARY_COLOR} className='overflow-hidden text-ellipsis'>
              You will need to provide an additional {formattedAnte} ETH to cover the gas fees in the event that you are
              liquidated. If you successfully repay your loan, you will be refunded the ETH.
            </Text>
          )}
        </div>
        <div className='w-full'>
          <BorrowButton
            marginAccount={marginAccount}
            userAddress={userAddress}
            borrowToken={borrowToken}
            borrowAmount={borrowAmountBig}
            shouldProvideAnte={shouldProvideAnte}
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
