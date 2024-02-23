import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import Big from 'big.js';
import { BigNumber, ethers } from 'ethers';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import {
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput, truncateDecimals } from 'shared/lib/util/Numbers';
import { Address, useAccount, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import { isHealthy, maxWithdraws } from '../../../data/BalanceSheet';
import { BorrowerNftBorrower } from '../../../data/BorrowerNft';
import { Assets } from '../../../data/MarginAccount';
import HealthBar from '../../common/HealthBar';
import TokenAmountSelectInput from '../../portfolio/TokenAmountSelectInput';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  PENDING,
  READY,
  LOADING,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.symbol}`,
        enabled: false,
      };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading...', enabled: false };
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type RemoveCollateralButtonProps = {
  borrower: BorrowerNftBorrower;
  userAddress: Address;
  collateralToken: Token;
  collateralAmount: GN;
  userBalance: GN;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: SendTransactionResult | null) => void;
};

function RemoveCollateralButton(props: RemoveCollateralButtonProps) {
  const { borrower, userAddress, collateralToken, collateralAmount, userBalance, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);

  const [isPending, setIsPending] = useState(false);

  const isToken0Collateral = collateralToken.address === borrower.token0.address;

  const amount0 = isToken0Collateral ? collateralAmount : GN.zero(collateralToken.decimals);
  const amount1 = isToken0Collateral ? GN.zero(collateralToken.decimals) : collateralAmount;

  const encodedData = useMemo(() => {
    const borrowerInterface = new ethers.utils.Interface(borrowerAbi);
    return borrowerInterface.encodeFunctionData('transfer', [
      amount0.toBigNumber(),
      amount1.toBigNumber(),
      userAddress,
    ]);
  }, [amount0, amount1, userAddress]);

  const { config: removeCollateralConfig } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'modify',
    args: [
      userAddress,
      [borrower.index],
      [ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS[activeChain.id]],
      [encodedData as `0x${string}`],
      [0],
    ],
    enabled: Boolean(userAddress) && collateralAmount.isGtZero() && collateralAmount.lte(userBalance),
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

  if (collateralAmount.gt(userBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, collateralToken);

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

export type RemoveCollateralModalProps = {
  borrower: BorrowerNftBorrower;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function RemoveCollateralModal(props: RemoveCollateralModalProps) {
  const { borrower, isOpen, setIsOpen, setPendingTxn } = props;

  const [collateralAmountStr, setCollateralAmountStr] = useState('');
  const [collateralToken, setCollateralToken] = useState(borrower.token0);

  const { address: userAddress } = useAccount();

  // Reset the collateral amount and token when modal is opened/closed or when the margin account token0 changes
  useEffect(() => {
    setCollateralAmountStr('');
    setCollateralToken(borrower.token0);
  }, [isOpen, borrower.token0]);

  const tokenOptions = [borrower.token0, borrower.token1];
  const isToken0 = collateralToken.address === borrower.token0.address;

  const existingCollateralRaw = isToken0 ? borrower.assets.token0Raw : borrower.assets.token1Raw;

  const existingCollateral = GN.fromNumber(existingCollateralRaw, collateralToken.decimals);
  const collateralAmount = GN.fromDecimalString(collateralAmountStr || '0', collateralToken.decimals);

  const newCollateralAmount = GN.max(existingCollateral.sub(collateralAmount), GN.zero(collateralToken.decimals));

  if (!userAddress || !isOpen) {
    return null;
  }

  const maxWithdrawBasedOnHealth = maxWithdraws(
    borrower.assets,
    borrower.liabilities,
    borrower.uniswapPositions ?? [],
    borrower.sqrtPriceX96,
    borrower.iv,
    borrower.nSigma,
    borrower.token0.decimals,
    borrower.token1.decimals
  )[isToken0 ? 0 : 1];
  const max = Math.min(existingCollateralRaw, maxWithdrawBasedOnHealth);
  // Mitigate the case when the number is represented in scientific notation
  const bigMax = BigNumber.from(new Big(max).mul(10 ** collateralToken.decimals).toFixed(0));
  const maxString = ethers.utils.formatUnits(bigMax, collateralToken.decimals);

  // TODO: Utilize GN for this
  const newAssets: Assets = {
    token0Raw: isToken0 ? newCollateralAmount.toNumber() : borrower.assets.token0Raw,
    token1Raw: isToken0 ? borrower.assets.token1Raw : newCollateralAmount.toNumber(),
    uni0: borrower.assets.uni0,
    uni1: borrower.assets.uni1,
  };

  const { health: newHealth } = isHealthy(
    newAssets,
    borrower.liabilities,
    borrower.uniswapPositions ?? [],
    borrower.sqrtPriceX96,
    borrower.iv,
    borrower.nSigma,
    borrower.token0.decimals,
    borrower.token1.decimals
  );

  return (
    <Modal isOpen={isOpen} title='Remove Collateral' setIsOpen={setIsOpen} maxHeight='650px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Collateral Amount
            </Text>
            <BaseMaxButton
              size='L'
              onClick={() => {
                setCollateralAmountStr(maxString);
              }}
            >
              MAX
            </BaseMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={collateralAmountStr}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, collateralToken.decimals);
                setCollateralAmountStr(truncatedOutput);
              }
            }}
            onSelect={(option: Token) => {
              setCollateralAmountStr('');
              setCollateralToken(option);
            }}
            options={tokenOptions}
            selectedOption={collateralToken}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're removing{' '}
            <strong>
              {collateralAmountStr || '0.00'} {collateralToken.symbol}
            </strong>{' '}
            collateral from this{' '}
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
        <div className='w-full'>
          <RemoveCollateralButton
            borrower={borrower}
            userAddress={userAddress}
            collateralToken={collateralToken}
            collateralAmount={collateralAmount}
            userBalance={existingCollateral}
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
