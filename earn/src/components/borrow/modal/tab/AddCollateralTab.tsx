import { useContext, useEffect, useState, useMemo } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import Big from 'big.js';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import { Text } from 'shared/lib/components/common/Typography';
import { useAccount, useBalance, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../../App';
import ERC20ABI from '../../../../assets/abis/ERC20.json';
import { MarginAccount } from '../../../../data/MarginAccount';
import { Token } from '../../../../data/Token';
import { formatNumberInput, truncateDecimals } from '../../../../util/Numbers';
import TokenAmountSelectInput from '../../../portfolio/TokenAmountSelectInput';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room

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

type AddCollateralButtonProps = {
  marginAccount: MarginAccount;
  collateralToken: Token;
  collateralAmount: Big;
  userBalance: Big;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: SendTransactionResult | null) => void;
};

function AddCollateralButton(props: AddCollateralButtonProps) {
  const { marginAccount, collateralToken, collateralAmount, userBalance, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);

  const [isPending, setIsPending] = useState(false);

  const { config: contractWriteConfig } = usePrepareContractWrite({
    address: collateralToken.address,
    abi: ERC20ABI,
    functionName: 'transfer',
    args: [marginAccount.address, collateralAmount.toFixed()],
    enabled: !!collateralAmount && !!userBalance && collateralAmount.lte(userBalance),
    chainId: activeChain.id,
  });
  const contractWriteConfigUpdatedRequest = useMemo(() => {
    if (contractWriteConfig.request) {
      return {
        ...contractWriteConfig.request,
        gasLimit: contractWriteConfig.request.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100),
      };
    }
    return undefined;
  }, [contractWriteConfig.request]);
  const {
    write: contractWrite,
    data: contractData,
    isSuccess: contractDidSucceed,
    isLoading: contractIsLoading,
  } = useContractWrite({
    ...contractWriteConfig,
    request: contractWriteConfigUpdatedRequest,
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

export type AddCollateralTabProps = {
  marginAccount: MarginAccount;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export function AddCollateralTab(props: AddCollateralTabProps) {
  const { marginAccount, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);

  const [collateralAmount, setCollateralAmount] = useState('');
  const [collateralToken, setCollateralToken] = useState(marginAccount.token0);

  const { address: userAddress } = useAccount();

  const { refetch: refetchBalance, data: userBalance } = useBalance({
    address: userAddress,
    token: collateralToken.address,
    chainId: activeChain.id,
    watch: false,
    // enabled: isOpen,
  });

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    interval = setInterval(() => {
      refetchBalance();
    }, 13_000);
    if (!interval != null) {
      clearInterval(interval);
    }
    return () => {
      if (interval != null) {
        clearInterval(interval);
      }
    };
  }, [refetchBalance]);

  // Reset collateral amount and token when modal is opened/closed or when the margin account token0 changes
  useEffect(() => {
    setCollateralAmount('');
    setCollateralToken(marginAccount.token0);
  }, [marginAccount.token0]);

  const tokenOptions = [marginAccount.token0, marginAccount.token1];

  const existingCollateral =
    collateralToken.address === marginAccount.token0.address
      ? marginAccount.assets.token0Raw
      : marginAccount.assets.token1Raw;

  const numericCollateralAmount = Number(collateralAmount) || 0;

  const collateralAmountBig = new Big(numericCollateralAmount).mul(10 ** collateralToken.decimals);

  const existingCollateralBig = new Big(existingCollateral).mul(10 ** collateralToken.decimals);

  const numericUserBalance = Number(userBalance?.formatted ?? 0) || 0;
  const userBalanceBig = new Big(numericUserBalance).mul(10 ** collateralToken.decimals);

  if (!userAddress) {
    return null;
  }

  const newCollateralBig = existingCollateralBig.add(collateralAmountBig).div(10 ** collateralToken.decimals);

  return (
    <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
      <div className='flex flex-col gap-1 w-full'>
        <div className='flex flex-row justify-between mb-1'>
          <Text size='M' weight='bold'>
            Collateral Amount
          </Text>
          <BaseMaxButton
            size='L'
            onClick={() => {
              if (userBalance != null) {
                setCollateralAmount(userBalance?.formatted);
              }
            }}
          >
            MAX
          </BaseMaxButton>
        </div>
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
          You're adding{' '}
          <strong>
            {collateralAmount || '0.00'} {collateralToken.ticker}
          </strong>{' '}
          as collateral to this{' '}
          <strong>
            {marginAccount.token0.ticker}/{marginAccount.token1.ticker}
          </strong>{' '}
          smart wallet. Your total collateral for this token in this smart wallet will be{' '}
          <strong>
            {truncateDecimals(newCollateralBig.toString(), collateralToken.decimals)} {collateralToken.ticker}
          </strong>
          .
        </Text>
      </div>
      <div className='w-full'>
        <AddCollateralButton
          marginAccount={marginAccount}
          collateralToken={collateralToken}
          collateralAmount={collateralAmountBig}
          userBalance={userBalanceBig}
          setIsOpen={setIsOpen}
          setPendingTxn={setPendingTxn}
        />
        <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
          By using our service, you agree to our{' '}
          <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
            Terms of Service
          </a>{' '}
          and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
          your duty to educate yourself and be aware of the risks.
        </Text>
      </div>
    </div>
  );
}
