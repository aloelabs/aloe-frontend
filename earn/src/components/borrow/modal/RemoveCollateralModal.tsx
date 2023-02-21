import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import Big from 'big.js';
import { ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import MarginAccountABI from '../../../assets/abis/MarginAccount.json';
import { ALOE_II_WITHDRAW_MANAGER_ADDRESS } from '../../../data/constants/Addresses';
import { MarginAccount, MarketInfo } from '../../../data/MarginAccount';
import { Token } from '../../../data/Token';
import { formatNumberInput, truncateDecimals } from '../../../util/Numbers';
import TokenAmountSelectInput from '../../portfolio/TokenAmountSelectInput';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  PENDING,
  READY,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.ticker}`,
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

type RemoveCollateralButtonProps = {
  marginAccount: MarginAccount;
  userAddress: string;
  collateralToken: Token;
  collateralAmount: Big;
  userBalance: Big;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: SendTransactionResult | null) => void;
};

function RemoveCollateralButton(props: RemoveCollateralButtonProps) {
  const { marginAccount, userAddress, collateralToken, collateralAmount, userBalance, setIsOpen, setPendingTxn } =
    props;
  const { activeChain } = useContext(ChainContext);

  const [isPending, setIsPending] = useState(false);

  const isToken0Collateral = collateralToken.address === marginAccount.token0.address;

  const amount0Big = isToken0Collateral ? collateralAmount : new Big(0);
  const amount1Big = isToken0Collateral ? new Big(0) : collateralAmount;

  const { config: removeCollateralConfig } = usePrepareContractWrite({
    address: marginAccount.address,
    abi: MarginAccountABI,
    functionName: 'modify',
    args: [
      ALOE_II_WITHDRAW_MANAGER_ADDRESS,
      ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256', 'address'],
        [amount0Big.toFixed(), amount1Big.toFixed(), userAddress]
      ),
      [isToken0Collateral, !isToken0Collateral],
    ],
    enabled: !!userAddress && collateralAmount.gt(0) && collateralAmount.lte(userBalance),
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
  marginAccount: MarginAccount;
  marketInfo: MarketInfo;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function RemoveCollateralModal(props: RemoveCollateralModalProps) {
  const { marginAccount, isOpen, setIsOpen, setPendingTxn } = props;

  const [collateralAmount, setCollateralAmount] = useState('');
  const [collateralToken, setCollateralToken] = useState(marginAccount.token0);

  const { address: userAddress } = useAccount();

  // Reset the collateral amount and token when modal is opened/closed or when the margin account token0 changes
  useEffect(() => {
    setCollateralAmount('');
    setCollateralToken(marginAccount.token0);
  }, [isOpen, marginAccount.token0]);

  const tokenOptions = [marginAccount.token0, marginAccount.token1];

  const existingCollateral =
    collateralToken.address === marginAccount.token0.address
      ? marginAccount.assets.token0Raw
      : marginAccount.assets.token1Raw;

  const numericCollateralAmount = Number(collateralAmount) || 0;

  const existingCollateralBig = new Big(existingCollateral).mul(10 ** collateralToken.decimals);
  const numericCollateralAmountBig = new Big(numericCollateralAmount).mul(10 ** collateralToken.decimals);

  const newCollateralAmount = Math.max(
    existingCollateralBig
      .sub(numericCollateralAmountBig)
      .div(10 ** collateralToken.decimals)
      .toNumber(),
    0
  );

  if (!userAddress || !isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} title='Remove Collateral' setIsOpen={setIsOpen} maxHeight='650px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Collateral Amount
          </Text>
          <TokenAmountSelectInput
            inputValue={collateralAmount}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, collateralToken.decimals);
                setCollateralAmount(truncatedOutput);
              }
            }}
            onSelect={(option: Token) => {
              setCollateralAmount('');
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
              {collateralAmount || '0.00'} {collateralToken.ticker}
            </strong>{' '}
            collateral from this{' '}
            <strong>
              {marginAccount.token0.ticker}/{marginAccount.token1.ticker}
            </strong>{' '}
            smart wallet. Your total collateral for this token in this smart wallet will be{' '}
            <strong>
              {truncateDecimals(newCollateralAmount.toString(), collateralToken.decimals)} {collateralToken.ticker}
            </strong>
            .
          </Text>
        </div>
        <div className='w-full'>
          <RemoveCollateralButton
            marginAccount={marginAccount}
            userAddress={userAddress}
            collateralToken={collateralToken}
            collateralAmount={numericCollateralAmountBig}
            userBalance={existingCollateralBig}
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
