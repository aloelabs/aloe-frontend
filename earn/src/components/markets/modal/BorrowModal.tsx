import { useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerLensAbi } from 'shared/lib/abis/BorrowerLens';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { permit2Abi } from 'shared/lib/abis/Permit2';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import { SquareInputWithMax } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { computeLTV } from 'shared/lib/data/BalanceSheet';
import {
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
  ALOE_II_PERMIT2_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { Q32, TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { LendingPair } from 'shared/lib/data/LendingPair';
import { Token } from 'shared/lib/data/Token';
import { useBorrowerNftRefs } from 'shared/lib/hooks/UseBorrowerNft';
import useChain from 'shared/lib/hooks/UseChain';
import { Permit2State, usePermit2 } from 'shared/lib/hooks/UsePermit2';
import { formatNumberInput } from 'shared/lib/util/Numbers';
import { generateBytes12Salt } from 'shared/lib/util/Salt';
import { encodeFunctionData, Hex } from 'viem';
import { useAccount, useBalance, useReadContract, useSimulateContract, useWriteContract } from 'wagmi';

const MAX_BORROW_PERCENTAGE = 0.8;
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  READY,
  PERMIT_ASSET,
  APPROVE_ASSET,
  LOADING,
  INSUFFICIENT_ASSET,
  INSUFFICIENT_COLLATERAL,
  WAITING_FOR_USER,
  WAITING_FOR_TRANSACTION,
  INSUFFICIENT_ANTE,
  CONNECT_WALLET,
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
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading', enabled: false };
    case ConfirmButtonState.PERMIT_ASSET:
      return { text: `Permit ${token.symbol}`, enabled: true };
    case ConfirmButtonState.APPROVE_ASSET:
      return { text: `Approve ${token.symbol}`, enabled: true };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.WAITING_FOR_TRANSACTION:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return { text: 'Insufficient Asset', enabled: false };
    case ConfirmButtonState.INSUFFICIENT_COLLATERAL:
      return { text: 'Insufficient Collateral', enabled: false };
    case ConfirmButtonState.INSUFFICIENT_ANTE:
      return { text: 'Insufficient Ante', enabled: false };
    case ConfirmButtonState.CONNECT_WALLET:
      return { text: 'Connect Wallet', enabled: false };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

export type BorrowModalProps = {
  isOpen: boolean;
  selectedLendingPair: LendingPair;
  selectedCollateral: Token;
  selectedBorrow: Token;
  userBalance: GN;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function BorrowModal(props: BorrowModalProps) {
  const { isOpen, selectedLendingPair, selectedCollateral, selectedBorrow, userBalance, setIsOpen, setPendingTxn } =
    props;

  const activeChain = useChain();
  const { address: userAddress } = useAccount();

  const [collateralAmountStr, setCollateralAmountStr] = useState<string>('');
  const [borrowAmountStr, setBorrowAmountStr] = useState<string>('');

  const borrowerNftFilterParams = useMemo(
    () => ({
      validUniswapPool: selectedLendingPair.uniswapPool,
      onlyCheckMostRecentModify: true,
      includeUnusedBorrowers: true,
    }),
    [selectedLendingPair.uniswapPool]
  );
  const { borrowerNftRefs } = useBorrowerNftRefs(userAddress, activeChain.id, borrowerNftFilterParams);
  const availableNft = useMemo(() => borrowerNftRefs.at(0), [borrowerNftRefs]);

  const { data: consultData } = useReadContract({
    abi: volatilityOracleAbi,
    address: ALOE_II_ORACLE_ADDRESS[activeChain.id],
    args: [selectedLendingPair?.uniswapPool || '0x', Q32],
    functionName: 'consult',
    query: { enabled: selectedLendingPair !== undefined },
  });

  const { data: ethBalanceData } = useBalance({
    address: userAddress,
    chainId: activeChain.id,
    query: { enabled: Boolean(userAddress) },
  });

  const collateralAmount = GN.fromDecimalString(collateralAmountStr || '0', selectedCollateral.decimals);
  const borrowAmount = GN.fromDecimalString(borrowAmountStr || '0', selectedBorrow.decimals);
  const ante = selectedLendingPair.factoryData.ante;
  const ethBalance = GN.fromDecimalString(ethBalanceData?.formatted ?? '0', 18);

  const isBorrowingToken0 = useMemo(
    () => selectedBorrow.equals(selectedLendingPair.token0),
    [selectedLendingPair, selectedBorrow]
  );

  const maxBorrowSupplyConstraint = useMemo(() => {
    if (selectedBorrow === undefined) {
      return null;
    }
    return selectedLendingPair[isBorrowingToken0 ? 'kitty0Info' : 'kitty1Info'].availableAssets;
  }, [selectedBorrow, selectedLendingPair, isBorrowingToken0]);

  const maxBorrowHealthConstraint = useMemo(() => {
    if (consultData === undefined || selectedBorrow === undefined) {
      return null;
    }
    const sqrtPriceX96 = GN.fromBigInt(consultData[1] ?? 0n, 96, 2);
    const nSigma = selectedLendingPair?.factoryData.nSigma ?? 0;
    const iv = Number(consultData[2] / 1_000_000n) / 1e6;
    const ltv = computeLTV(iv, nSigma);

    let inTermsOfBorrow = collateralAmount;
    if (selectedLendingPair?.token0.address === selectedCollateral.address) {
      inTermsOfBorrow = inTermsOfBorrow.mul(sqrtPriceX96).mul(sqrtPriceX96).setResolution(selectedBorrow.decimals);
    } else {
      inTermsOfBorrow = inTermsOfBorrow.div(sqrtPriceX96).div(sqrtPriceX96).setResolution(selectedBorrow.decimals);
    }
    return inTermsOfBorrow.recklessMul(ltv);
  }, [
    collateralAmount,
    consultData,
    selectedBorrow,
    selectedCollateral.address,
    selectedLendingPair?.factoryData.nSigma,
    selectedLendingPair?.token0.address,
  ]);

  const maxBorrowAmount = useMemo(() => {
    if (maxBorrowSupplyConstraint == null || maxBorrowHealthConstraint == null) return null;
    return GN.min(maxBorrowSupplyConstraint, maxBorrowHealthConstraint);
  }, [maxBorrowSupplyConstraint, maxBorrowHealthConstraint]);

  const eightyPercentMaxBorrowAmount = useMemo(() => {
    if (maxBorrowAmount === null) return null;
    return maxBorrowAmount.recklessMul(MAX_BORROW_PERCENTAGE);
  }, [maxBorrowAmount]);

  const estimatedApr = useMemo(() => {
    const { kitty0Info, kitty1Info } = selectedLendingPair;

    return (isBorrowingToken0 ? kitty0Info : kitty1Info).hypotheticalBorrowAPR(borrowAmount) * 100;
  }, [selectedLendingPair, isBorrowingToken0, borrowAmount]);

  // The NFT index we will use if minting
  const { data: nextNftPtrIdx } = useReadContract({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'balanceOf',
    args: [userAddress ?? '0x'],
    chainId: activeChain.id,
    query: { enabled: Boolean(userAddress) && availableNft === undefined },
  });

  const {
    state: permit2State,
    action: permit2Action,
    result: permit2Result,
  } = usePermit2(
    activeChain,
    selectedCollateral,
    userAddress ?? '0x',
    ALOE_II_PERMIT2_MANAGER_ADDRESS[activeChain.id],
    collateralAmount
  );

  const generatedSalt = useMemo(() => generateBytes12Salt(), []);

  const { data: predictedAddress } = useReadContract({
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
    query: { enabled: selectedLendingPair !== undefined },
  });

  const encodedPermit2 = useMemo(() => {
    const borrowerAddress = availableNft?.address ?? predictedAddress;
    if (!userAddress || !borrowerAddress || !permit2Result.signature) return null;

    return encodeFunctionData({
      abi: permit2Abi,
      functionName: 'permitTransferFrom',
      args: [
        {
          permitted: {
            token: selectedCollateral.address,
            amount: permit2Result.amount.toBigInt(),
          },
          nonce: BigInt(permit2Result.nonce ?? '0'),
          deadline: BigInt(permit2Result.deadline),
        },
        {
          to: borrowerAddress,
          requestedAmount: permit2Result.amount.toBigInt(),
        },
        userAddress,
        permit2Result.signature,
      ],
    })
  }, [permit2Result, availableNft, predictedAddress, selectedCollateral.address, userAddress]);

  // First, we `mint` so that they have a `Borrower` to put stuff in
  const encodedMint = useMemo(() => {
    if (!userAddress || selectedLendingPair?.uniswapPool === undefined) return null;
    const to = userAddress;
    const pools = [selectedLendingPair.uniswapPool];
    const salts = [generatedSalt];

    return encodeFunctionData({
      abi: borrowerNftAbi,
      functionName: 'mint',
      args: [to, pools, salts],
    });
  }, [userAddress, selectedLendingPair?.uniswapPool, generatedSalt]);

  const encodedBorrowCall = useMemo(() => {
    if (!userAddress || !selectedLendingPair || !selectedBorrow) return null;
    const amount0 =
      selectedLendingPair.token0.address === selectedBorrow.address ? borrowAmount : GN.zero(selectedBorrow.decimals);
    const amount1 =
      selectedLendingPair.token1.address === selectedBorrow.address ? borrowAmount : GN.zero(selectedBorrow.decimals);

    return encodeFunctionData({
      abi: borrowerAbi,
      functionName: 'borrow',
      args: [amount0.toBigInt(), amount1.toBigInt(), userAddress],
    });
  }, [borrowAmount, selectedBorrow, selectedLendingPair, userAddress]);

  const encodedModify = useMemo(() => {
    const index = Boolean(availableNft)
      ? availableNft!.index
      : nextNftPtrIdx !== undefined
      ? Number(nextNftPtrIdx)
      : undefined;
    if (!userAddress || index === undefined || ante === undefined || !encodedPermit2 || !encodedBorrowCall) return null;

    const owner = userAddress;
    const indices = [index];
    const managers = [ALOE_II_PERMIT2_MANAGER_ADDRESS[activeChain.id]];
    const datas = [encodedPermit2.concat(encodedBorrowCall.slice(2)) as Hex];
    const antes = [ante.toBigNumber().div(1e13).toNumber()];

    return encodeFunctionData({
      abi: borrowerNftAbi,
      functionName: 'modify',
      args: [owner, indices, managers, datas, antes],
    });
  }, [availableNft, nextNftPtrIdx, userAddress, ante, encodedPermit2, encodedBorrowCall, activeChain.id]);

  const {
    data: configMulticallOps,
    isError: isUnableToMulticallOps,
    isLoading: isCheckingIfAbleToMulticallOps,
  } = useSimulateContract({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'multicall',
    args: [Boolean(availableNft) ? [encodedModify ?? '0x'] : [encodedMint ?? '0x', encodedModify ?? '0x']],
    value: ante?.toBigInt(),
    chainId: activeChain.id,
    query: { enabled: userAddress && Boolean(encodedMint) && Boolean(encodedModify) },
  });
  const { writeContractAsync: borrow, isPending: isAskingUserToMulticallOps } = useWriteContract();

  let confirmButtonState: ConfirmButtonState;
  if (!userAddress) {
    confirmButtonState = ConfirmButtonState.CONNECT_WALLET;
  } else if (ante === undefined || maxBorrowSupplyConstraint == null || maxBorrowHealthConstraint == null) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (
    isAskingUserToMulticallOps ||
    permit2State === Permit2State.ASKING_USER_TO_SIGN ||
    permit2State === Permit2State.ASKING_USER_TO_APPROVE
  ) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_USER;
  } else if (collateralAmount.gt(userBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (borrowAmount.gt(maxBorrowSupplyConstraint) || borrowAmount.gt(maxBorrowHealthConstraint)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_COLLATERAL;
  } else if (ethBalance.lt(ante)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ANTE;
  } else if (collateralAmountStr === '' || borrowAmountStr === '') {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else {
    confirmButtonState = permit2StateToButtonStateMap[permit2State] ?? ConfirmButtonState.READY;
  }

  const confirmButton = getConfirmButton(confirmButtonState, selectedCollateral);

  if (!selectedBorrow) return null;

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Open a new position'>
      <div className='w-full flex flex-col gap-4'>
        <div>
          <Text size='M' weight='bold'>
            Collateral
          </Text>
          <TokenAmountInput
            token={selectedCollateral}
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
              {selectedBorrow.symbol}
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
                if (eightyPercentMaxBorrowAmount) {
                  setBorrowAmountStr(eightyPercentMaxBorrowAmount.toString(GNFormat.DECIMAL));
                }
              }}
              maxDisabled={eightyPercentMaxBorrowAmount === null || borrowAmount.eq(eightyPercentMaxBorrowAmount)}
              maxButtonText='80% Max'
              placeholder='0.00'
              fullWidth={true}
              inputClassName={borrowAmountStr !== '' ? 'active' : ''}
            />
          </div>
          <div className='flex flex-col gap-1 w-full mt-4'>
            <Text size='M' weight='bold'>
              Summary
            </Text>
            <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
              You're borrowing{' '}
              <strong>
                {borrowAmountStr || '0.00'} {selectedBorrow.symbol}
              </strong>{' '}
              using a new{' '}
              <strong>
                {selectedLendingPair?.token0.symbol}/{selectedLendingPair?.token1.symbol}
              </strong>{' '}
              smart wallet.
            </Text>
            {ante?.isGtZero() && (
              <Text size='XS' color={TERTIARY_COLOR} className='overflow-hidden text-ellipsis'>
                You will need to provide an additional {ante.toString(GNFormat.LOSSY_HUMAN)} ETH to cover the gas fees
                in the event that you are liquidated.
              </Text>
            )}
            <div className='flex gap-2 mt-2'>
              <Text size='S'>APR:</Text>
              <Display size='XS'>{estimatedApr.toFixed(2)}%</Display>
            </div>
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
              borrow(configMulticallOps.request)
                .then((hash) => {
                  setIsOpen(false);
                  setPendingTxn(hash);
                })
                .catch((e) => console.error(e));
            }
          }}
        >
          {confirmButton.text}
        </FilledGradientButton>
      </div>
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By borrowing, you agree to our{' '}
        <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </Modal>
  );
}
