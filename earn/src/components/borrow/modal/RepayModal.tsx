import { useContext, useState, useMemo, useEffect } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import Big from 'big.js';
import { ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount, usePrepareContractWrite, useContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import MarginAccountABI from '../../../assets/abis/MarginAccount.json';
import { ALOE_II_SIMPLE_MANAGER } from '../../../data/constants/Addresses';
import { MarginAccount, MarketInfo } from '../../../data/MarginAccount';
import { Token } from '../../../data/Token';
import { formatNumberInput, truncateDecimals } from '../../../util/Numbers';
import TokenAmountSelectInput from '../../portfolio/TokenAmountSelectInput';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_COLLATERAL,
  REPAYING_TOO_MUCH,
  PENDING,
  READY,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_COLLATERAL:
      return {
        text: `Insufficient ${token.ticker} collateral`,
        enabled: false,
      };
    case ConfirmButtonState.REPAYING_TOO_MUCH:
      return {
        text: 'Repaying too much',
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

type RepayButtonProps = {
  marginAccount: MarginAccount;
  userAddress: string;
  repayToken: Token;
  repayAmount: Big;
  collateralAmount: Big;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: SendTransactionResult | null) => void;
};

function RepayButton(props: RepayButtonProps) {
  const { marginAccount, userAddress, repayToken, repayAmount, collateralAmount, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);

  const [isPending, setIsPending] = useState(false);

  const isRepayingToken0 = repayToken.address === marginAccount.token0.address;

  const amount0Big = isRepayingToken0 ? repayAmount : new Big(0);
  const amount1Big = isRepayingToken0 ? new Big(0) : repayAmount;

  const liabilityAmount = isRepayingToken0 ? marginAccount.liabilities.amount0 : marginAccount.liabilities.amount1;
  const liabilityAmountBig = new Big(liabilityAmount.toString()).mul(10 ** repayToken.decimals);

  const marginAccountInterface = new ethers.utils.Interface(MarginAccountABI);
  const encodedData = marginAccountInterface.encodeFunctionData('repay', [amount0Big.toFixed(), amount1Big.toFixed()]);

  const { config: removeCollateralConfig } = usePrepareContractWrite({
    address: marginAccount.address,
    abi: MarginAccountABI,
    functionName: 'modify',
    args: [ALOE_II_SIMPLE_MANAGER, encodedData, [false, false]],
    enabled:
      !!userAddress && repayAmount.gt(0) && repayAmount.lte(liabilityAmountBig) && repayAmount.lte(collateralAmount),
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

  if (repayAmount.gt(collateralAmount)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_COLLATERAL;
  } else if (repayAmount.gt(liabilityAmountBig)) {
    confirmButtonState = ConfirmButtonState.REPAYING_TOO_MUCH;
  } else if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, repayToken);

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

export type RepayModalProps = {
  marginAccount: MarginAccount;
  marketInfo: MarketInfo;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function RepayModal(props: RepayModalProps) {
  const { marginAccount, isOpen, setIsOpen, setPendingTxn } = props;

  const [repayAmount, setRepayAmount] = useState('');
  const [repayToken, setRepayToken] = useState<Token>(marginAccount.token0);

  const { address: userAddress } = useAccount();

  const resetModal = () => {
    setRepayAmount('');
    setRepayToken(marginAccount.token0);
  };

  const tokenOptions = [marginAccount.token0, marginAccount.token1];

  const numericBorrowAmount = Number(repayAmount) || 0;
  const numericExistingLiability =
    repayToken.address === marginAccount.token0.address
      ? marginAccount.liabilities.amount0
      : marginAccount.liabilities.amount1;
  const numericCollateralAmount =
    repayToken.address === marginAccount.token0.address
      ? marginAccount.assets.token0Raw
      : marginAccount.assets.token1Raw;
  const repayAmountBig = new Big(numericBorrowAmount).mul(10 ** repayToken.decimals);
  const existingLiabilityBig = new Big(numericExistingLiability).mul(10 ** repayToken.decimals);
  const collateralAmountBig = new Big(numericCollateralAmount).mul(10 ** repayToken.decimals);

  const newLiability = existingLiabilityBig.minus(repayAmountBig).div(10 ** repayToken.decimals);
  const newCollateral = collateralAmountBig.minus(repayAmountBig).div(10 ** repayToken.decimals);

  const maxRepayAmount = Math.min(numericExistingLiability, numericCollateralAmount);

  if (!userAddress || !isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      title='Repay'
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
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Repay Amount
            </Text>
            <BaseMaxButton
              size='L'
              onClick={() => {
                setRepayAmount(maxRepayAmount.toString());
              }}
            >
              MAX
            </BaseMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={repayAmount}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, repayToken.decimals);
                setRepayAmount(truncatedOutput);
              }
            }}
            onSelect={(option: Token) => {
              setRepayAmount('');
              setRepayToken(option);
            }}
            options={tokenOptions}
            selectedOption={repayToken}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're repaying{' '}
            <strong>
              {repayAmount || '0.00'} {repayToken.ticker}
            </strong>{' '}
            worth of liabilities in your{' '}
            <strong>
              {marginAccount.token0.ticker}/{marginAccount.token1.ticker}
            </strong>{' '}
            smart wallet using your collateral. Your total liabilities for this token in this smart wallet will be
            reduced to{' '}
            <strong>
              {truncateDecimals(newLiability.toString(), repayToken.decimals)} {repayToken.ticker}
            </strong>
            , and your collateral will be reduced to{' '}
            <strong>
              {truncateDecimals(newCollateral.toString(), repayToken.decimals)} {repayToken.ticker}
            </strong>
            .
          </Text>
        </div>
        <div className='w-full'>
          <RepayButton
            marginAccount={marginAccount}
            userAddress={userAddress}
            repayToken={repayToken}
            repayAmount={repayAmountBig}
            collateralAmount={collateralAmountBig}
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
