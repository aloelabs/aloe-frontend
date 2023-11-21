import { useContext, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber, ethers } from 'ethers';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerLensAbi } from 'shared/lib/abis/BorrowerLens';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { permit2Abi } from 'shared/lib/abis/Permit2';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import { SquareInputWithMax } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Text } from 'shared/lib/components/common/Typography';
import {
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
  ALOE_II_PERMIT2_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { Q32 } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Permit2State, usePermit2 } from 'shared/lib/data/hooks/UsePermit2';
import { formatNumberInput } from 'shared/lib/util/Numbers';
import { generateBytes12Salt } from 'shared/lib/util/Salt';
import { useAccount, useBalance, useContractRead, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import { computeLTV } from '../../../data/BalanceSheet';
import { BorrowEntry, CollateralEntry } from '../BorrowingWidget';

const MAX_BORROW_PERCENTAGE = 0.8;

enum ConfirmButtonState {
  WAITING_FOR_USER,
  READY,
  LOADING,
  INSUFFICIENT_ASSET,
  INSUFFICIENT_ANTE,
  DISABLED,
}

function getConfirmButton(state: ConfirmButtonState): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading', enabled: false };
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return { text: 'Insufficient Asset', enabled: false };
    case ConfirmButtonState.INSUFFICIENT_ANTE:
      return { text: 'Insufficient Ante', enabled: false };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

export type BorrowModalProps = {
  isOpen: boolean;
  selectedBorrows: BorrowEntry[];
  selectedCollateral: CollateralEntry;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function BorrowModal(props: BorrowModalProps) {
  const { isOpen, selectedBorrows, selectedCollateral, setIsOpen, setPendingTxn } = props;
  const [collateralAmountStr, setCollateralAmountStr] = useState<string>('');
  const [borrowAmountStr, setBorrowAmountStr] = useState<string>('');
  const { activeChain } = useContext(ChainContext);

  const { address: userAddress } = useAccount();

  const selectedBorrow = selectedBorrows.find(
    (borrow) => borrow.collateral.address === selectedCollateral.asset.address
  );

  const selectedLendingPair = selectedCollateral.matchingPairs.find(
    (pair) => selectedBorrow?.asset?.equals(pair.token0) || selectedBorrow?.asset?.equals(pair.token1)
  );

  const { data: consultData } = useContractRead({
    abi: volatilityOracleAbi,
    address: ALOE_II_ORACLE_ADDRESS[activeChain.id],
    args: [selectedLendingPair?.uniswapPool || '0x', Q32],
    functionName: 'consult',
    enabled: selectedLendingPair !== undefined,
  });

  const { data: parameterData } = useContractRead({
    abi: factoryAbi,
    address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
    args: [selectedLendingPair?.uniswapPool || '0x'],
    functionName: 'getParameters',
    enabled: selectedLendingPair !== undefined,
  });

  const { data: ethBalanceData } = useBalance({
    address: userAddress,
    chainId: activeChain.id,
    enabled: Boolean(userAddress),
    watch: false,
  });

  const userBalance = GN.fromNumber(selectedCollateral.balance, selectedCollateral.asset.decimals);
  const collateralAmount = GN.fromDecimalString(collateralAmountStr || '0', selectedCollateral.asset.decimals);
  const borrowAmount = GN.fromDecimalString(borrowAmountStr || '0', selectedBorrow?.asset.decimals ?? 0);
  const ante = parameterData !== undefined ? GN.fromBigNumber(parameterData.ante, 18) : undefined;
  const ethBalance = GN.fromDecimalString(ethBalanceData?.formatted ?? '0', 18);

  const maxBorrowAmount = useMemo(() => {
    if (consultData === undefined || selectedBorrow === undefined) {
      return null;
    }
    const sqrtPriceX96 = GN.fromBigNumber(consultData?.[1] ?? BigNumber.from('0'), 96, 2);
    const nSigma = selectedLendingPair?.nSigma ?? 0;
    const iv = consultData[2].div(1e6).toNumber() / 1e6;
    const ltv = computeLTV(iv, nSigma);

    let inTermsOfBorrow = collateralAmount;
    if (selectedLendingPair?.token0.address === selectedCollateral.asset.address) {
      inTermsOfBorrow = inTermsOfBorrow
        .mul(sqrtPriceX96)
        .mul(sqrtPriceX96)
        .setResolution(selectedBorrow.asset.decimals);
    } else {
      inTermsOfBorrow = inTermsOfBorrow
        .div(sqrtPriceX96)
        .div(sqrtPriceX96)
        .setResolution(selectedBorrow.asset.decimals);
    }
    const maxBorrowSupplyConstraint = GN.fromNumber(selectedBorrow.supply, selectedBorrow.asset.decimals);
    const maxBorrowHealthConstraint = inTermsOfBorrow.recklessMul(ltv);
    return GN.min(maxBorrowSupplyConstraint, maxBorrowHealthConstraint).recklessMul(MAX_BORROW_PERCENTAGE);
  }, [
    consultData,
    selectedBorrow,
    selectedLendingPair?.nSigma,
    selectedLendingPair?.token0.address,
    collateralAmount,
    selectedCollateral.asset.address,
  ]);

  // The NFT index we will use if minting
  const { data: nextNftPtrIdx } = useContractRead({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'balanceOf',
    args: [userAddress ?? '0x'],
    chainId: activeChain.id,
    enabled: Boolean(userAddress),
  });

  const {
    state: permit2State,
    action: permit2Action,
    result: permit2Result,
  } = usePermit2(
    activeChain,
    selectedCollateral.asset,
    userAddress ?? '0x',
    ALOE_II_PERMIT2_MANAGER_ADDRESS[activeChain.id],
    collateralAmount
  );

  const generatedSalt = useMemo(() => generateBytes12Salt(), []);

  const { data: predictedAddress } = useContractRead({
    abi: borrowerLensAbi,
    address: ALOE_II_BORROWER_LENS_ADDRESS[activeChain.id],
    functionName: 'predictBorrowerAddress',
    args: [
      selectedLendingPair?.uniswapPool ?? '0x',
      ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
      generatedSalt,
      ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
      ALOE_II_FACTORY_ADDRESS[activeChain.id],
    ],
    enabled: selectedLendingPair !== undefined,
  });

  const encodedPermit2 = useMemo(() => {
    if (!userAddress || !predictedAddress || !permit2Result.signature) return null;
    const permit2 = new ethers.utils.Interface(permit2Abi);
    return permit2.encodeFunctionData(
      'permitTransferFrom(((address,uint256),uint256,uint256),(address,uint256),address,bytes)',
      [
        {
          permitted: {
            token: selectedCollateral.asset.address,
            amount: permit2Result.amount.toBigNumber(),
          },
          nonce: BigNumber.from(permit2Result.nonce ?? '0'),
          deadline: BigNumber.from(permit2Result.deadline),
        },
        {
          to: predictedAddress,
          requestedAmount: permit2Result.amount.toBigNumber(),
        },
        userAddress,
        permit2Result.signature,
      ]
    );
  }, [permit2Result, predictedAddress, selectedCollateral.asset.address, userAddress]);

  // Prepare for actual import/mint transaction
  const borrowerNft = useMemo(() => new ethers.utils.Interface(borrowerNftAbi), []);
  // First, we `mint` so that they have a `Borrower` to put stuff in
  const encodedMint = useMemo(() => {
    if (!userAddress || selectedLendingPair?.uniswapPool === undefined) return null;
    const to = userAddress;
    const pools = [selectedLendingPair.uniswapPool ?? '0x'];
    const salts = [generatedSalt];
    return borrowerNft.encodeFunctionData('mint', [to, pools, salts]) as `0x${string}`;
  }, [userAddress, selectedLendingPair?.uniswapPool, generatedSalt, borrowerNft]);

  const encodedBorrowCall = useMemo(() => {
    if (!userAddress || !selectedLendingPair || !selectedBorrow) return null;
    const borrower = new ethers.utils.Interface(borrowerAbi);
    const amount0 =
      selectedLendingPair.token0.address === selectedBorrow.asset.address
        ? borrowAmount
        : GN.zero(selectedBorrow.asset.decimals);
    const amount1 =
      selectedLendingPair.token1.address === selectedBorrow.asset.address
        ? borrowAmount
        : GN.zero(selectedBorrow.asset.decimals);

    return borrower.encodeFunctionData('borrow', [amount0.toBigNumber(), amount1.toBigNumber(), userAddress]);
  }, [borrowAmount, selectedBorrow, selectedLendingPair, userAddress]);

  const encodedModify = useMemo(() => {
    if (!userAddress || nextNftPtrIdx === undefined || ante === undefined || !encodedPermit2 || !encodedBorrowCall)
      return null;
    const owner = userAddress;
    const indices = [nextNftPtrIdx];
    const managers = [ALOE_II_PERMIT2_MANAGER_ADDRESS[activeChain.id]];
    const datas = [encodedPermit2.concat(encodedBorrowCall.slice(2))];
    const antes = [ante.toBigNumber().div(1e13)];
    return borrowerNft.encodeFunctionData('modify', [owner, indices, managers, datas, antes]) as `0x${string}`;
  }, [userAddress, nextNftPtrIdx, ante, activeChain.id, encodedPermit2, encodedBorrowCall, borrowerNft]);

  const {
    config: configMulticallOps,
    isError: isUnableToMulticallOps,
    isLoading: isCheckingIfAbleToMulticallOps,
  } = usePrepareContractWrite({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'multicall',
    args: [[encodedMint ?? '0x', encodedModify ?? '0x']],
    overrides: { value: ante?.toBigNumber() },
    chainId: activeChain.id,
    enabled: userAddress && Boolean(encodedMint) && Boolean(encodedModify) && parameterData !== undefined,
  });
  const gasLimit = configMulticallOps.request?.gasLimit.mul(110).div(100);
  const { write: borrow, isLoading: isAskingUserToMulticallOps } = useContractWrite({
    ...configMulticallOps,
    request: {
      ...configMulticallOps.request,
      gasLimit,
    },
    onSuccess(data) {
      setPendingTxn(data);
    },
  });

  let confirmButtonState: ConfirmButtonState;
  if (ante === undefined) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (
    isAskingUserToMulticallOps ||
    permit2State === Permit2State.ASKING_USER_TO_SIGN ||
    permit2State === Permit2State.ASKING_USER_TO_APPROVE
  ) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_USER;
  } else if (collateralAmount.gt(userBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (ethBalance.lt(ante)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ANTE;
  } else if (collateralAmountStr === '') {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else {
    confirmButtonState = ConfirmButtonState.READY;
  }

  const confirmButton = getConfirmButton(confirmButtonState);

  if (!selectedBorrow) return null;

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Borrow'>
      <div className='w-full flex flex-col gap-4'>
        <div>
          <Text size='M' weight='bold'>
            Collateral
          </Text>
          <TokenAmountInput
            token={selectedCollateral.asset}
            value={collateralAmountStr}
            max={userBalance.toString(GNFormat.DECIMAL)}
            maxed={collateralAmount.eq(userBalance)}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                setCollateralAmountStr(output);
              }
            }}
          />
        </div>
        <div>
          <Text size='M' weight='bold'>
            Borrow
          </Text>
          <div>
            <Text size='M' className='mb-2'>
              {selectedBorrow.asset.symbol}
            </Text>
            <SquareInputWithMax
              size='L'
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const output = formatNumberInput(event.target.value);
                if (output != null) {
                  setBorrowAmountStr(output);
                }
              }}
              value={borrowAmountStr}
              onMaxClick={() => {
                if (maxBorrowAmount) {
                  setBorrowAmountStr(maxBorrowAmount.toString(GNFormat.DECIMAL));
                }
              }}
              maxDisabled={maxBorrowAmount === null || borrowAmount.eq(maxBorrowAmount)}
              maxButtonText='80% Max'
              placeholder='0.00'
              fullWidth={true}
              inputClassName={borrowAmountStr !== '' ? 'active' : ''}
            />
          </div>
        </div>
        <FilledGradientButton
          size='M'
          fillWidth={true}
          disabled={!confirmButton.enabled}
          onClick={() => {
            // TODO: clean this up
            if (permit2State !== Permit2State.DONE) {
              permit2Action?.();
            } else if (
              confirmButton.enabled &&
              !isUnableToMulticallOps &&
              !isCheckingIfAbleToMulticallOps &&
              configMulticallOps
            ) {
              borrow?.();
            }
          }}
        >
          {confirmButton.text}
        </FilledGradientButton>
      </div>
    </Modal>
  );
}
