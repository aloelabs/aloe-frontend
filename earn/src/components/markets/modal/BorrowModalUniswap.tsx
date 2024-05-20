import { useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import Big from 'big.js';
import { BigNumber, ethers } from 'ethers';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import { SquareInputWithMax } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import TokenIcon from 'shared/lib/components/common/TokenIcon';
import TokenIcons from 'shared/lib/components/common/TokenIcons';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { maxBorrowAndWithdraw } from 'shared/lib/data/BalanceSheet';
import { Assets } from 'shared/lib/data/Borrower';
import {
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
  ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS,
  UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { Q32, TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import useChain from 'shared/lib/data/hooks/UseChain';
import { LendingPair } from 'shared/lib/data/LendingPair';
import { Token } from 'shared/lib/data/Token';
import { UniswapNFTPosition, zip } from 'shared/lib/data/Uniswap';
import { formatNumberInput, formatTokenAmount } from 'shared/lib/util/Numbers';
import { generateBytes12Salt } from 'shared/lib/util/Salt';
import { erc721Abi } from 'viem';
import { useAccount, useBalance, usePublicClient, useReadContract, useSimulateContract, useWriteContract } from 'wagmi';

const MAX_BORROW_PERCENTAGE = 0.8;
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  READY,
  APPROVE_NFT_MANAGER,
  LOADING,
  INSUFFICIENT_ASSET,
  INSUFFICIENT_COLLATERAL,
  WAITING_FOR_USER,
  WAITING_FOR_TRANSACTION,
  INSUFFICIENT_ANTE,
  CONNECT_WALLET,
  DISABLED,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading', enabled: false };
    case ConfirmButtonState.APPROVE_NFT_MANAGER:
      return { text: `Approve NFT Transfer`, enabled: true };
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
  selectedCollateral: UniswapNFTPosition;
  selectedBorrow: Token;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function BorrowModalUniswap(props: BorrowModalProps) {
  const {
    isOpen,
    selectedLendingPair,
    selectedCollateral: uniswapPosition,
    selectedBorrow,
    setIsOpen,
    setPendingTxn,
  } = props;
  const [borrowAmountStr, setBorrowAmountStr] = useState<string>('');
  const [isApproving, setIsApproving] = useState(false);
  const activeChain = useChain();

  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient({ chainId: activeChain.id });

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

  const { refetch: refetchGetApprovedData, data: getApprovedData } = useReadContract({
    address: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[activeChain.id],
    abi: erc721Abi,
    functionName: 'getApproved',
    args: [BigInt(uniswapPosition.tokenId)] as const,
    chainId: activeChain.id,
  });
  const { writeContractAsync: writeApproveAsync } = useWriteContract();
  const isApproved = getApprovedData === ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS[activeChain.id];

  const selectedCollateral = uniswapPosition.token0.equals(selectedBorrow)
    ? uniswapPosition.token1
    : uniswapPosition.token0;

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
    const lenderInfo = selectedLendingPair[isBorrowingToken0 ? 'kitty0Info' : 'kitty1Info'];
    return lenderInfo.availableAssets.toNumber();
  }, [selectedBorrow, selectedLendingPair, isBorrowingToken0]);

  const maxBorrowHealthConstraint = useMemo(() => {
    if (consultData === undefined || selectedBorrow === undefined) {
      return null;
    }

    const [max0, max1] = maxBorrowAndWithdraw(
      new Assets(GN.zero(selectedLendingPair.token0.decimals), GN.zero(selectedLendingPair.token1.decimals), [
        uniswapPosition,
      ]),
      { amount0: 0, amount1: 0 },
      new Big(consultData[1].toString()),
      selectedLendingPair.iv,
      selectedLendingPair.factoryData.nSigma,
      selectedLendingPair.token0.decimals,
      selectedLendingPair.token1.decimals
    );

    return selectedBorrow.equals(selectedLendingPair.token0) ? max0 : max1;
  }, [consultData, uniswapPosition, selectedBorrow, selectedLendingPair]);

  const maxBorrowAmount =
    maxBorrowSupplyConstraint == null || maxBorrowHealthConstraint == null
      ? null
      : Math.min(maxBorrowSupplyConstraint, maxBorrowHealthConstraint);

  const eightyPercentMaxBorrowAmountStr =
    maxBorrowAmount === null ? null : formatTokenAmount(maxBorrowAmount * MAX_BORROW_PERCENTAGE);

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
    query: { enabled: Boolean(userAddress) },
  });

  const generatedSalt = useMemo(() => generateBytes12Salt(), []);

  // Prepare for actual import/mint transaction
  const borrowerNft = useMemo(() => new ethers.utils.Interface(borrowerNftAbi), []);
  // First, we `mint` so that they have a `Borrower` to put stuff in
  const encodedMint = useMemo(() => {
    if (!userAddress) return null;
    const to = userAddress;
    const pools = [selectedLendingPair.uniswapPool];
    const salts = [generatedSalt];
    return borrowerNft.encodeFunctionData('mint', [to, pools, salts]) as `0x${string}`;
  }, [userAddress, selectedLendingPair, generatedSalt, borrowerNft]);

  // Then we use the UniswapNFTManager to import the Uniswap NFT as collateral
  const encodedImportCall = useMemo(() => {
    return ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'int24', 'int24', 'int128', 'uint208'],
      [
        uniswapPosition.tokenId,
        uniswapPosition.lower,
        uniswapPosition.upper,
        `-${uniswapPosition.liquidity.toString(10)}`,
        zip([uniswapPosition], '0x83ee755b'),
      ]
    ) as `0x${string}`;
  }, [uniswapPosition]);

  // Finally, we borrow the requested tokens
  const encodedBorrowCall = useMemo(() => {
    if (!userAddress) return null;
    const borrower = new ethers.utils.Interface(borrowerAbi);
    const amount0 = selectedBorrow.equals(selectedLendingPair.token0)
      ? borrowAmount
      : GN.zero(selectedLendingPair.token0.decimals);
    const amount1 = selectedBorrow.equals(selectedLendingPair.token1)
      ? borrowAmount
      : GN.zero(selectedLendingPair.token1.decimals);

    return borrower.encodeFunctionData('borrow', [amount0.toBigNumber(), amount1.toBigNumber(), userAddress]);
  }, [borrowAmount, selectedBorrow, selectedLendingPair, userAddress]);

  const encodedModify = useMemo(() => {
    if (!userAddress || nextNftPtrIdx === undefined || !encodedBorrowCall) return null;
    const owner = userAddress;
    const indices = [nextNftPtrIdx, nextNftPtrIdx];
    const managers = [
      ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS[activeChain.id],
      ALOE_II_BORROWER_NFT_SIMPLE_MANAGER_ADDRESS[activeChain.id],
    ];
    const datas = [encodedImportCall, encodedBorrowCall];
    const antes = [ante.toBigNumber().div(1e13), BigNumber.from(0)];
    return borrowerNft.encodeFunctionData('modify', [owner, indices, managers, datas, antes]) as `0x${string}`;
  }, [userAddress, nextNftPtrIdx, ante, activeChain.id, encodedImportCall, encodedBorrowCall, borrowerNft]);

  const { data: multicallConfig } = useSimulateContract({
    address: ALOE_II_BORROWER_NFT_ADDRESS[activeChain.id],
    abi: borrowerNftAbi,
    functionName: 'multicall',
    args: [[encodedMint ?? '0x', encodedModify ?? '0x']],
    value: ante.toBigInt(),
    chainId: activeChain.id,
    query: { enabled: userAddress && Boolean(encodedMint) && Boolean(encodedModify) && isApproved },
  });
  const { writeContractAsync: multicallWrite, isPending: isAskingUserToMulticall } = useWriteContract();

  let confirmButtonState: ConfirmButtonState;

  if (!userAddress) {
    confirmButtonState = ConfirmButtonState.CONNECT_WALLET;
  } else if (isApproving) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_TRANSACTION;
  } else if (!isApproved) {
    confirmButtonState = ConfirmButtonState.APPROVE_NFT_MANAGER;
  } else if (ante === undefined || maxBorrowAmount == null) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (isAskingUserToMulticall) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_USER;
  } else if (borrowAmount.toNumber() > maxBorrowAmount) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_COLLATERAL;
  } else if (ethBalance.lt(ante)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ANTE;
  } else if (borrowAmountStr === '') {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else {
    confirmButtonState = ConfirmButtonState.READY;
  }

  const confirmButton = getConfirmButton(confirmButtonState, selectedCollateral);

  if (!selectedBorrow) return null;

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Open a new position'>
      <div className='w-full flex flex-col gap-4'>
        <Text size='M' weight='bold'>
          Collateral
        </Text>
        <div className='flex items-center gap-3'>
          <TokenIcons tokens={[uniswapPosition.token0, uniswapPosition.token1]} />
          <Display size='XS'>Uniswap Position #{uniswapPosition.tokenId}</Display>
        </div>
        <Text size='M' weight='bold'>
          Borrow
        </Text>
        <div className='flex flex-col gap-2'>
          <div className='flex items-center gap-3'>
            <TokenIcon token={selectedBorrow} />
            <Display size='XS'>{selectedBorrow.symbol}</Display>
          </div>
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
              if (eightyPercentMaxBorrowAmountStr) {
                setBorrowAmountStr(eightyPercentMaxBorrowAmountStr);
              }
            }}
            maxDisabled={
              eightyPercentMaxBorrowAmountStr === null || eightyPercentMaxBorrowAmountStr === borrowAmountStr
            }
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
            You're importing Uniswap Position <strong>#{uniswapPosition.tokenId}</strong> as collateral and using it to
            borrow{' '}
            <strong>
              {borrowAmountStr || '0.00'} {selectedBorrow.symbol}
            </strong>
            . You'll also receive a{' '}
            <strong>
              {selectedLendingPair?.token0.symbol}/{selectedLendingPair?.token1.symbol}
            </strong>{' '}
            Borrower NFT.
          </Text>
          {ante.isGtZero() && (
            <Text size='XS' color={TERTIARY_COLOR} className='overflow-hidden text-ellipsis'>
              You will need to provide an additional {ante.toString(GNFormat.LOSSY_HUMAN)} ETH to cover the gas fees in
              the event that you are liquidated.
            </Text>
          )}
          <div className='flex gap-2 mt-2'>
            <Text size='S'>APR:</Text>
            <Display size='XS'>{estimatedApr.toFixed(2)}%</Display>
          </div>
        </div>
        <FilledGradientButton
          size='M'
          fillWidth={true}
          disabled={!confirmButton.enabled}
          onClick={() => {
            if (!isApproved) {
              writeApproveAsync({
                address: UNISWAP_NONFUNGIBLE_POSITION_MANAGER_ADDRESS[activeChain.id],
                abi: erc721Abi,
                functionName: 'approve',
                chainId: activeChain.id,
                args: [ALOE_II_UNISWAP_NFT_MANAGER_ADDRESS[activeChain.id], BigInt(uniswapPosition.tokenId)],
                gas: 100000n,
              }).then(async (hash) => {
                setIsApproving(true);
                await publicClient?.waitForTransactionReceipt({ hash, confirmations: 1 });
                refetchGetApprovedData();
                setIsApproving(false);
              });
            } else {
              multicallWrite(multicallConfig!.request)
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
