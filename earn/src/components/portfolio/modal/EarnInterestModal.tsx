import { useEffect, useMemo, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { routerAbi } from 'shared/lib/abis/Router';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import Tooltip from 'shared/lib/components/common/Tooltip';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_ROUTER_ADDRESS, ETH_RESERVED_FOR_GAS } from 'shared/lib/data/constants/ChainSpecific';
import { ROUTER_TRANSMITTANCE, TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import useChain from 'shared/lib/data/hooks/UseChain';
import { usePermit2, Permit2State } from 'shared/lib/data/hooks/UsePermit2';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput, roundPercentage, truncateDecimals } from 'shared/lib/util/Numbers';
import { Address } from 'viem';
import { useAccount, useBalance, useSimulateContract, useWriteContract } from 'wagmi';

import { LendingPair } from '../../../data/LendingPair';
import PairDropdown from '../../common/PairDropdown';
import TokenAmountSelectInput from '../TokenAmountSelectInput';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  PERMIT_ASSET,
  APPROVE_ASSET,
  WAITING_FOR_TRANSACTION,
  WAITING_FOR_USER,
  LOADING,
  READY,
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
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.symbol}`,
        enabled: false,
      };
    case ConfirmButtonState.PERMIT_ASSET:
      return {
        text: `Permit ${token.symbol}`,
        enabled: true,
      };
    case ConfirmButtonState.APPROVE_ASSET:
      return {
        text: `Approve ${token.symbol}`,
        enabled: true,
      };
    case ConfirmButtonState.WAITING_FOR_TRANSACTION:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type DepositButtonProps = {
  supplyAmount: GN;
  userBalanceTotal: GN;
  userBalanceToken: GN;
  token: Token;
  kitty: Kitty;
  accountAddress: Address;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

function DepositButton(props: DepositButtonProps) {
  const { supplyAmount, userBalanceTotal, userBalanceToken, token, kitty, accountAddress, setIsOpen, setPendingTxn } =
    props;
  const activeChain = useChain();
  const [isPending, setIsPending] = useState(false);

  const supplyAmountToken = GN.min(supplyAmount, userBalanceToken);
  const supplyAmountEth = supplyAmount.lte(userBalanceTotal) ? supplyAmount.sub(supplyAmountToken) : undefined;

  const {
    state: permit2State,
    action: permit2Action,
    result: permit2Result,
  } = usePermit2(activeChain, token, accountAddress, ALOE_II_ROUTER_ADDRESS[activeChain.id], supplyAmountToken);

  const { data: depsitWithPermit2Config, refetch: refetchDepositWithPermit2 } = useSimulateContract({
    address: ALOE_II_ROUTER_ADDRESS[activeChain.id],
    abi: routerAbi,
    functionName: 'depositWithPermit2',
    args: [
      kitty.address,
      permit2Result.amount.toBigInt(),
      ROUTER_TRANSMITTANCE,
      BigInt(permit2Result.nonce ?? '0'),
      BigInt(permit2Result.deadline),
      permit2Result.signature ?? '0x',
    ],
    value: supplyAmountEth?.toBigInt(),
    chainId: activeChain.id,
    query: { enabled: permit2State === Permit2State.DONE },
  });
  const {
    writeContract: depositWithPermit2,
    isError: contractDidError,
    isSuccess: contractDidSucceed,
    data: contractData,
  } = useWriteContract();

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
      setIsOpen(false);
    } else if (contractDidError) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractDidError, setPendingTxn, setIsOpen]);

  let confirmButtonState: ConfirmButtonState;
  if (isPending) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_TRANSACTION;
  } else if (supplyAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (supplyAmount.gt(userBalanceTotal)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else {
    confirmButtonState = permit2StateToButtonStateMap[permit2State] ?? ConfirmButtonState.READY;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  function handleClickConfirm() {
    if (permit2Action) {
      permit2Action();
      return;
    }

    if (confirmButtonState === ConfirmButtonState.READY) {
      if (!depsitWithPermit2Config) {
        refetchDepositWithPermit2();
        return;
      }
      setIsPending(true);
      depositWithPermit2(depsitWithPermit2Config.request);
    }
  }

  return (
    <FilledStylizedButton
      size='M'
      onClick={() => handleClickConfirm()}
      fillWidth={true}
      disabled={!confirmButton.enabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type EarnInterestModalProps = {
  isOpen: boolean;
  options: Token[];
  defaultOption: Token;
  lendingPairs: LendingPair[];
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function EarnInterestModal(props: EarnInterestModalProps) {
  const { isOpen, options, defaultOption, lendingPairs, setIsOpen, setPendingTxn } = props;
  const activeChain = useChain();
  const [selectedOption, setSelectedOption] = useState<Token>(defaultOption);
  const [activePairOptions, setActivePairOptions] = useState<LendingPair[]>([]);
  const [selectedPairOption, setSelectedPairOption] = useState<LendingPair | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const account = useAccount();

  function resetModal() {
    setSelectedOption(defaultOption);
    setInputValue('');
  }

  useEffect(() => {
    const pairs = lendingPairs.filter((pair) => pair.token0 === selectedOption || pair.token1 === selectedOption);
    setActivePairOptions(pairs);
    setSelectedPairOption(pairs[0]);
  }, [lendingPairs, selectedOption]);

  useEffect(() => {
    setSelectedOption(defaultOption);
  }, [defaultOption]);

  // Get the user's balance of the selected token
  const { refetch: refetchBalanceToken, data: tokenBalanceResult } = useBalance({
    address: account?.address ?? '0x',
    token: selectedOption.address,
    chainId: activeChain.id,
    query: { enabled: isOpen },
  });

  const isWeth = selectedOption.name === 'Wrapped Ether';
  const { refetch: refetchBalanceEth, data: ethBalanceResult } = useBalance({
    address: account?.address ?? '0x',
    chainId: activeChain.id,
    query: { enabled: isOpen && isWeth },
  });

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    if (isOpen) {
      interval = setInterval(() => {
        refetchBalanceToken();
        refetchBalanceEth();
      }, 13_000);
    }
    if (!isOpen && interval != null) {
      clearInterval(interval);
    }
    return () => {
      if (interval != null) {
        clearInterval(interval);
      }
    };
  }, [refetchBalanceToken, refetchBalanceEth, isOpen]);

  // Get the active kitty that corresponds to the selected token and is in
  // the selected token / collateral token lending pair
  const [activeKitty, activeKittyInfo] = useMemo(() => {
    for (const lendingPair of lendingPairs) {
      if (selectedPairOption?.equals(lendingPair)) {
        return lendingPair.token0.address === selectedOption.address
          ? [lendingPair.kitty0, lendingPair.kitty0Info]
          : [lendingPair.kitty1, lendingPair.kitty1Info];
      }
    }
    return [null, null];
  }, [selectedPairOption, selectedOption, lendingPairs]);

  if (selectedPairOption == null || activeKitty == null) {
    return null;
  }

  const peerAsset: Token =
    selectedOption.address === selectedPairOption.token0.address
      ? selectedPairOption.token1
      : selectedPairOption.token0;

  const tokenBalance = GN.fromBigInt(tokenBalanceResult?.value ?? 0n, selectedOption.decimals);
  const ethBalance = GN.fromBigInt(ethBalanceResult?.value ?? 0n, 18);
  const userBalance = isWeth
    ? tokenBalance.add(GN.max(ethBalance.sub(ETH_RESERVED_FOR_GAS[activeChain.id]), GN.zero(18)))
    : tokenBalance;

  const supplyAmount = GN.fromDecimalString(inputValue || '0', selectedOption.decimals);

  return (
    <Modal
      isOpen={isOpen}
      title='Deposit'
      setIsOpen={(open: boolean) => {
        setIsOpen(open);
        if (!open) {
          resetModal();
        }
      }}
      maxHeight='650px'
    >
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Amount
            </Text>
            <BaseMaxButton
              size='L'
              onClick={() => {
                if (tokenBalanceResult != null) {
                  setInputValue(userBalance.toString(GNFormat.DECIMAL));
                }
              }}
            >
              MAX
            </BaseMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={inputValue}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, selectedOption.decimals);
                setInputValue(truncatedOutput);
              }
            }}
            options={options}
            onSelect={(updatedOption: Token) => {
              setSelectedOption(updatedOption);
              setInputValue('');
            }}
            selectedOption={selectedOption}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex items-center gap-2'>
            <Text size='M' weight='bold'>
              Lending Pair
            </Text>
            <Tooltip
              buttonSize='S'
              buttonText=''
              content={`You earn interest when other users borrow your assets. To do that, they have to post${' '}
              collateral. Your choice of Lending Pair determines what kind of collateral is allowed. Never deposit${' '}
              to a pair that includes unknown or untrustworthy tokens.`}
              position='top-center'
              filled={true}
            />
          </div>
          <PairDropdown
            options={activePairOptions}
            onSelect={setSelectedPairOption}
            selectedOption={selectedPairOption}
            size='L'
            compact={false}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex items-center gap-2'>
            <Text size='M' weight='bold'>
              Estimated APY
            </Text>
            <Tooltip
              buttonSize='S'
              buttonText=''
              content={`The actual APY is dynamic and is calculated based on the utilization of the pool.`}
              position='top-center'
              filled={true}
            />
          </div>
          <Text size='L' weight='bold' color={SECONDARY_COLOR}>
            {roundPercentage((activeKittyInfo?.lendAPY ?? 0) * 100, 2).toFixed(2)}%
          </Text>
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're depositing{' '}
            <strong>
              {inputValue || '0.00'} {selectedOption.symbol}
            </strong>{' '}
            to the{' '}
            <strong>
              {selectedPairOption.token0.symbol}/{selectedPairOption.token1.symbol}
            </strong>{' '}
            lending market. Other users will be able to borrow your {selectedOption.symbol} by posting{' '}
            {peerAsset.symbol} or {selectedOption.symbol} as collateral. When they pay interest, you earn interest.
          </Text>
        </div>
        <div className='w-full'>
          <DepositButton
            supplyAmount={supplyAmount}
            userBalanceTotal={userBalance}
            userBalanceToken={tokenBalance}
            token={selectedOption}
            kitty={activeKitty}
            accountAddress={account.address ?? '0x'}
            setIsOpen={(open: boolean) => {
              setIsOpen(open);
              if (!open) {
                resetModal();
              }
            }}
            setPendingTxn={setPendingTxn}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By depositing, you agree to our{' '}
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
