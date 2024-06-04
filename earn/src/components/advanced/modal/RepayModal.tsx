import { useState, useEffect } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { routerAbi } from 'shared/lib/abis/Router';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { isHealthy } from 'shared/lib/data/BalanceSheet';
import { Assets, Liabilities } from 'shared/lib/data/Borrower';
import {
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS,
  ALOE_II_ROUTER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import useChain from 'shared/lib/hooks/UseChain';
import { usePermit2, Permit2State } from 'shared/lib/hooks/UsePermit2';
import { formatNumberInput, truncateDecimals } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { Address, Chain, encodeFunctionData, Hex } from 'viem';
import { useAccount, useBalance, useSimulateContract, useWriteContract } from 'wagmi';

import { BorrowerNftBorrower, MarginAccount } from '../../../hooks/useDeprecatedMarginAccountShim';
import HealthBar from '../../common/HealthBar';
import TokenAmountSelectInput from '../../portfolio/TokenAmountSelectInput';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

const StyledCheckInput = styled.input`
  width: 14px;
  height: 14px;
  border-radius: 4px;
  cursor: pointer;
`;

enum ConfirmButtonState {
  INSUFFICIENT_FUNDS,
  REPAYING_TOO_MUCH,
  PERMIT_ASSET,
  APPROVE_ASSET,
  WAITING_FOR_TRANSACTION,
  WAITING_FOR_USER,
  READY,
  LOADING,
  DISABLED,
}

const permit2StateToButtonStateMap = {
  [Permit2State.ASKING_USER_TO_APPROVE]: ConfirmButtonState.WAITING_FOR_USER,
  [Permit2State.ASKING_USER_TO_SIGN]: ConfirmButtonState.WAITING_FOR_USER,
  [Permit2State.DONE]: undefined,
  [Permit2State.FETCHING_DATA]: ConfirmButtonState.LOADING,
  [Permit2State.READY_TO_APPROVE]: ConfirmButtonState.APPROVE_ASSET,
  [Permit2State.READY_TO_SIGN]: ConfirmButtonState.PERMIT_ASSET,
  [Permit2State.WAITING_FOR_TRANSACTION]: ConfirmButtonState.WAITING_FOR_TRANSACTION,
};

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_FUNDS:
      return { text: `Insufficient ${token.symbol}`, enabled: false };
    case ConfirmButtonState.REPAYING_TOO_MUCH:
      return { text: 'Repaying too much', enabled: false };
    case ConfirmButtonState.PERMIT_ASSET:
      return { text: `Permit ${token.symbol}`, enabled: true };
    case ConfirmButtonState.APPROVE_ASSET:
      return { text: `Approve ${token.symbol}`, enabled: true };
    case ConfirmButtonState.WAITING_FOR_TRANSACTION:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type RepayWithPermit2ButtonProps = {
  activeChain: Chain;
  marginAccount: MarginAccount;
  userAddress: Address;
  lender: Address;
  shouldRepayMax: boolean;
  repayAmount: GN;
  repayToken: Token;
  repayTokenBalance: GN;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: WriteContractReturnType | null) => void;
};

function RepayWithPermit2Button(props: RepayWithPermit2ButtonProps) {
  const {
    activeChain,
    marginAccount,
    userAddress,
    lender,
    shouldRepayMax,
    repayAmount: repayAmountSpecified,
    repayToken,
    repayTokenBalance,
    setIsOpen,
    setPendingTxn,
  } = props;
  const repayAmount = shouldRepayMax ? repayAmountSpecified.recklessMul(1.005) : repayAmountSpecified;

  const [isPending, setIsPending] = useState(false);

  const {
    state: permit2State,
    action: permit2Action,
    result: permit2Result,
  } = usePermit2(activeChain, repayToken, userAddress, ALOE_II_ROUTER_ADDRESS[activeChain.id], repayAmount);

  const { data: repayWithPermit2Config, refetch: refetchRepayWithPermit2 } = useSimulateContract({
    address: ALOE_II_ROUTER_ADDRESS[activeChain.id],
    abi: routerAbi,
    functionName: 'repayWithPermit2',
    args: [
      lender,
      shouldRepayMax,
      permit2Result.amount.toBigInt(),
      marginAccount.address,
      BigInt(permit2Result.nonce ?? '0'),
      BigInt(permit2Result.deadline),
      permit2Result.signature ?? '0x',
    ],
    chainId: activeChain.id,
    query: { enabled: permit2State === Permit2State.DONE },
  });
  const {
    writeContract: repayWithPermit2,
    isError: contractDidError,
    isSuccess: contractDidSucceed,
    data: contractData,
  } = useWriteContract();

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
      setIsOpen(false);
    } else if (contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractDidError, setPendingTxn, setIsOpen]);

  // MARK: Preparing data that's necessary to figure out button state -------------------------------------------------
  const existingLiability = marginAccount.liabilities[lender === marginAccount.lender0 ? 'amount0' : 'amount1'];
  const existingLiabilityGN = GN.fromNumber(existingLiability, repayToken.decimals);

  // MARK: Determining button state -----------------------------------------------------------------------------------
  let confirmButtonState: ConfirmButtonState;
  if (isPending) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_TRANSACTION;
  } else if (repayAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (repayAmount.gt(repayTokenBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_FUNDS;
  } else if (repayAmountSpecified.gt(existingLiabilityGN)) {
    confirmButtonState = ConfirmButtonState.REPAYING_TOO_MUCH;
  } else {
    confirmButtonState = permit2StateToButtonStateMap[permit2State] ?? ConfirmButtonState.READY;
  }

  // MARK: Get the button itself --------------------------------------------------------------------------------------
  // --> UI
  const confirmButton = getConfirmButton(confirmButtonState, repayToken);
  // --> action
  const confirmButtonAction = () => {
    if (permit2Action) {
      permit2Action();
      return;
    }

    if (confirmButtonState === ConfirmButtonState.READY) {
      if (!repayWithPermit2Config) {
        refetchRepayWithPermit2();
        return;
      }
      setIsPending(true);
      repayWithPermit2(repayWithPermit2Config.request);
    }
  };

  return (
    <FilledStylizedButton size='M' fillWidth={true} disabled={!confirmButton.enabled} onClick={confirmButtonAction}>
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

type RepayButtonProps = {
  activeChain: Chain;
  borrower: BorrowerNftBorrower;
  userAddress: Address;
  lender: Address;
  shouldRepayMax: boolean;
  repayAmount: GN;
  repayToken: Token;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: WriteContractReturnType | null) => void;
};

function RepayButton(props: RepayButtonProps) {
  const {
    activeChain,
    borrower,
    userAddress,
    lender,
    repayAmount: repayAmountSpecified,
    repayToken,
    setIsOpen,
    setPendingTxn,
  } = props;
  // TODO: Need new Manager contract in order to repay max this way
  // const repayAmount = shouldRepayMax ? repayAmountSpecified.recklessMul(1.005) : repayAmountSpecified;
  const repayAmount = repayAmountSpecified;

  const [isPending, setIsPending] = useState(false);

  const isToken0 = repayToken.equals(borrower.token0);
  const amount0Big = isToken0 ? repayAmount : GN.zero(repayToken.decimals);
  const amount1Big = isToken0 ? GN.zero(repayToken.decimals) : repayAmount;

  const encodedData = encodeFunctionData({
    abi: borrowerAbi,
    functionName: 'repay',
    args: [amount0Big.toBigInt(), amount1Big.toBigInt()],
  });

  const repayTokenBalance = borrower.assets[isToken0 ? 'amount0' : 'amount1'];

  const { data: repayConfig, refetch: refetchRepay } = useSimulateContract({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      userAddress,
      [borrower.index],
      [ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS[activeChain.id]],
      [encodedData as Hex],
      [0],
    ],
    query: { enabled: Boolean(userAddress) && repayAmount.isGtZero() },
    chainId: activeChain.id,
  });
  const {
    writeContract: repay,
    isSuccess: contractDidSucceed,
    isPending: contractIsLoading,
    data: contractData,
  } = useWriteContract();

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
      setIsOpen(false);
    } else if (!contractIsLoading && !contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractIsLoading, setPendingTxn, setIsOpen]);

  // MARK: Preparing data that's necessary to figure out button state -------------------------------------------------
  const existingLiability = borrower.liabilities[lender === borrower.lender0 ? 'amount0' : 'amount1'];
  const existingLiabilityGN = GN.fromNumber(existingLiability, repayToken.decimals);

  // MARK: Determining button state -----------------------------------------------------------------------------------
  let confirmButtonState: ConfirmButtonState;
  if (isPending) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_TRANSACTION;
  } else if (repayAmount.isZero() || contractIsLoading) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (repayAmount.gt(repayTokenBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_FUNDS;
  } else if (repayAmountSpecified.gt(existingLiabilityGN)) {
    confirmButtonState = ConfirmButtonState.REPAYING_TOO_MUCH;
  } else {
    confirmButtonState = ConfirmButtonState.READY;
  }

  // MARK: Get the button itself --------------------------------------------------------------------------------------
  // --> UI
  const confirmButton = getConfirmButton(confirmButtonState, repayToken);
  // --> action
  const confirmButtonAction = () => {
    if (confirmButtonState === ConfirmButtonState.READY) {
      if (!repayConfig) {
        refetchRepay();
        return;
      }
      setIsPending(true);
      repay(repayConfig!.request);
    }
  };

  return (
    <FilledStylizedButton size='M' fillWidth={true} disabled={!confirmButton.enabled} onClick={confirmButtonAction}>
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type RepayModalProps = {
  borrower: BorrowerNftBorrower;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function RepayModal(props: RepayModalProps) {
  const { borrower, isOpen, setIsOpen, setPendingTxn } = props;

  const activeChain = useChain();
  const [repayAmountStr, setRepayAmountStr] = useState('');
  const [repayToken, setRepayToken] = useState<Token>(borrower.token0);
  const [shouldRepayFromWallet, setShouldRepayFromWallet] = useState(true);

  const isToken0 = repayToken.equals(borrower.token0);

  const { address: userAddress } = useAccount();
  const { data: tokenBalanceFetch } = useBalance({
    address: userAddress,
    chainId: activeChain.id,
    token: repayToken.address,
    query: { enabled: isOpen },
  });
  const tokenBalance = shouldRepayFromWallet
    ? GN.fromBigInt(tokenBalanceFetch?.value ?? 0n, repayToken.decimals)
    : borrower.assets[isToken0 ? 'amount0' : 'amount1'];

  // Reset repay amount and token when modal is opened/closed or when the margin account token0 changes
  useEffect(() => {
    setRepayAmountStr('');
    setRepayToken(borrower.token0);
    setShouldRepayFromWallet(true);
  }, [isOpen, borrower.token0]);

  const existingLiabilityNumber =
    repayToken.address === borrower.token0.address ? borrower.liabilities.amount0 : borrower.liabilities.amount1;
  const existingLiability = GN.fromNumber(existingLiabilityNumber, repayToken.decimals);
  const repayAmount = GN.fromDecimalString(repayAmountStr || '0', repayToken.decimals);
  const remainingLiability = existingLiability.sub(repayAmount);

  const maxRepayStr = GN.min(existingLiability, tokenBalance).toString(GNFormat.DECIMAL);
  // NOTE: Don't just use `repayAmountStr === maxRepayStr` because the max repay flow will fail
  // if `tokenBalance` is the constraint.
  const shouldRepayMax = repayAmountStr === existingLiability.toString(GNFormat.DECIMAL);

  let newAssets = borrower.assets;
  if (!shouldRepayFromWallet) {
    newAssets = new Assets(
      isToken0 ? borrower.assets.amount0.sub(repayAmount) : borrower.assets.amount0,
      isToken0 ? borrower.assets.amount1 : borrower.assets.amount1.sub(repayAmount),
      borrower.assets.uniswapPositions
    );
  }
  const newLiabilities: Liabilities = {
    amount0: isToken0 ? parseFloat(remainingLiability.toString(GNFormat.DECIMAL)) : borrower.liabilities.amount0,
    amount1: repayToken.equals(borrower.token1)
      ? parseFloat(remainingLiability.toString(GNFormat.DECIMAL))
      : borrower.liabilities.amount1,
  };

  const { health: newHealth } = isHealthy(
    newAssets,
    newLiabilities,
    borrower.sqrtPriceX96,
    borrower.iv,
    borrower.nSigma,
    borrower.token0.decimals,
    borrower.token1.decimals
  );

  if (!userAddress || !isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} title='Repay' setIsOpen={setIsOpen} maxHeight='650px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex flex-row justify-between mt-1 mb-1'>
            <label className='flex gap-1 items-center'>
              <StyledCheckInput
                name='withdrawToWallet'
                type='checkbox'
                checked={shouldRepayFromWallet}
                onChange={() => setShouldRepayFromWallet(!shouldRepayFromWallet)}
              />
              <Text size='S' color={SECONDARY_COLOR} className='select-none'>
                Repay from wallet
              </Text>
            </label>
            <BaseMaxButton
              size='L'
              onClick={() => {
                setRepayAmountStr(maxRepayStr);
              }}
            >
              MAX
            </BaseMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={repayAmountStr}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, repayToken.decimals);
                setRepayAmountStr(truncatedOutput);
              }
            }}
            onSelect={(option: Token) => {
              setRepayAmountStr('');
              setRepayToken(option);
            }}
            options={[borrower.token0, borrower.token1]}
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
              {repayAmountStr || '0.00'} {repayToken.symbol}
            </strong>{' '}
            to the{' '}
            <strong>
              {borrower.token0.symbol}/{borrower.token1.symbol}
            </strong>{' '}
            market, bringing your total {repayToken.symbol} borrows in this NFT down to{' '}
            <strong>{remainingLiability.toString(GNFormat.DECIMAL)}</strong>. Funds will be sourced from{' '}
            {shouldRepayFromWallet ? 'your wallet' : 'the NFT itself'}.
          </Text>
          <div className='mt-2'>
            <HealthBar health={newHealth} />
          </div>
        </div>
        <div className='w-full'>
          {shouldRepayFromWallet ? (
            <RepayWithPermit2Button
              activeChain={activeChain}
              marginAccount={borrower}
              userAddress={userAddress}
              lender={isToken0 ? borrower.lender0 : borrower.lender1}
              shouldRepayMax={shouldRepayMax}
              repayAmount={repayAmount}
              repayToken={repayToken}
              repayTokenBalance={tokenBalance}
              setIsOpen={setIsOpen}
              setPendingTxn={setPendingTxn}
            />
          ) : (
            <RepayButton
              activeChain={activeChain}
              borrower={borrower}
              userAddress={userAddress}
              lender={isToken0 ? borrower.lender0 : borrower.lender1}
              shouldRepayMax={shouldRepayMax}
              repayAmount={repayAmount}
              repayToken={repayToken}
              setIsOpen={setIsOpen}
              setPendingTxn={setPendingTxn}
            />
          )}
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By using this interface, you agree to our{' '}
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
