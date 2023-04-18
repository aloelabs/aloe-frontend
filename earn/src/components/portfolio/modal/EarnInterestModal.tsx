import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { Address, useAccount, useBalance, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import RouterABI from '../../../assets/abis/Router.json';
import { ALOE_II_ROUTER_ADDRESS } from '../../../data/constants/Addresses';
import usePermit2 from '../../../data/hooks/UsePermit2';
import { Kitty } from '../../../data/Kitty';
import { LendingPair } from '../../../data/LendingPair';
import { Token } from '../../../data/Token';
import { ReferralData } from '../../../pages/PortfolioPage';
import { GN } from '../../../util/GoodNumber';
import { formatNumberInput, roundPercentage, truncateDecimals } from '../../../util/Numbers';
import PairDropdown from '../../common/PairDropdown';
import Tooltip from '../../common/Tooltip';
import TokenAmountSelectInput from '../TokenAmountSelectInput';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';
const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  PERMIT_ASSET,
  APPROVE_ASSET,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.ticker}`,
        enabled: false,
      };
    case ConfirmButtonState.PERMIT_ASSET:
      return {
        text: `Permit ${token.ticker}`,
        enabled: true,
      };
    case ConfirmButtonState.APPROVE_ASSET:
      return {
        text: `Approve ${token.ticker}`,
        enabled: true,
      };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type DepositButtonProps = {
  depositAmount: GN;
  depositBalance: GN;
  token: Token;
  kitty: Kitty;
  accountAddress: Address;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function DepositButton(props: DepositButtonProps) {
  const { depositAmount, depositBalance, token, kitty, accountAddress, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [isPending, setIsPending] = useState(false);

  const {
    steps,
    nextStep,
    isLoading,
    result: permit2Result,
  } = usePermit2(activeChain, token, accountAddress, ALOE_II_ROUTER_ADDRESS, depositAmount);

  const { config: depsitWithPermit2Config, refetch: refetchDepositWithPermit2 } = usePrepareContractWrite({
    address: ALOE_II_ROUTER_ADDRESS,
    abi: RouterABI,
    functionName: 'depositWithPermit2(address,uint256,uint256,uint256,bytes)',
    args: [
      kitty.address,
      permit2Result.amount.toBigNumber(),
      permit2Result.nonce,
      permit2Result.deadline,
      permit2Result.signature,
    ],
    chainId: activeChain.id,
    enabled:
      // TODO: utlize isGtZero once it's added
      depositAmount.gt(GN.fromDecimalString('0', token.decimals)) &&
      depositAmount.lte(depositBalance) &&
      permit2Result.nonce !== null &&
      permit2Result.signature !== undefined,
  });
  const depositWithPermit2ConfigUpdatedRequest = useMemo(() => {
    if (depsitWithPermit2Config.request) {
      return {
        ...depsitWithPermit2Config.request,
        gasLimit: depsitWithPermit2Config.request.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100),
      };
    }
    return undefined;
  }, [depsitWithPermit2Config.request]);
  const {
    write: depositWithPermit2,
    isError: contractDidError,
    isSuccess: contractDidSucceed,
    data: contractData,
  } = useContractWrite({
    ...depsitWithPermit2Config,
    request: depositWithPermit2ConfigUpdatedRequest,
  });

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
      setIsOpen(false);
    } else if (contractDidError) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractDidError, setPendingTxn, setIsOpen]);

  let confirmButtonState = ConfirmButtonState.READY;

  if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (depositAmount.eq(GN.fromDecimalString('0', token.decimals))) {
    // TODO: use isGtZero once it's added
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (depositAmount.gt(depositBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (isLoading) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (nextStep === 0 && !permit2Result?.signature) {
    confirmButtonState = ConfirmButtonState.APPROVE_ASSET;
  } else if (nextStep === 1 && !permit2Result?.signature) {
    confirmButtonState = ConfirmButtonState.PERMIT_ASSET;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  function handleClickConfirm() {
    const step = steps[nextStep];
    switch (confirmButtonState) {
      case ConfirmButtonState.APPROVE_ASSET:
        step?.()
          ?.then((txnResult) => {
            setIsPending(true);
            txnResult.wait(1).then(() => {
              setIsPending(false);
            });
          })
          .catch((_error) => {
            setIsPending(false);
          });
        break;
      case ConfirmButtonState.PERMIT_ASSET:
        step?.();
        break;
      case ConfirmButtonState.READY:
        if (!depsitWithPermit2Config.request) {
          refetchDepositWithPermit2();
          break;
        }
        setIsPending(true);
        depositWithPermit2?.();
        break;
      default:
        break;
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
  referralData: ReferralData | null;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function EarnInterestModal(props: EarnInterestModalProps) {
  const { isOpen, options, defaultOption, lendingPairs, referralData, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
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
  const { refetch: refetchDepositBalance, data: depositBalance } = useBalance({
    address: account?.address ?? '0x',
    token: selectedOption.address,
    chainId: activeChain.id,
    enabled: isOpen,
  });

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    if (isOpen) {
      interval = setInterval(() => {
        refetchDepositBalance();
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
  }, [refetchDepositBalance, isOpen]);

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

  const gnDepositAmount = GN.fromDecimalString(inputValue || '0', selectedOption.decimals);
  const gnDepositBalance = GN.fromDecimalString(depositBalance?.formatted ?? '0', selectedOption.decimals);

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
                if (depositBalance != null) {
                  setInputValue(depositBalance?.formatted);
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
            {roundPercentage(activeKittyInfo?.apy ?? 0, 2).toFixed(2)}%
          </Text>
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're depositing{' '}
            <strong>
              {inputValue || '0.00'} {selectedOption.ticker}
            </strong>{' '}
            to the{' '}
            <strong>
              {selectedPairOption.token0.ticker}/{selectedPairOption.token1.ticker}
            </strong>{' '}
            lending market. Other users will be able to borrow your {selectedOption.ticker} by posting{' '}
            {peerAsset.ticker} as collateral. When they pay interest, you earn interest.
          </Text>
        </div>
        <div className='w-full'>
          <DepositButton
            depositAmount={gnDepositAmount}
            depositBalance={gnDepositBalance}
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
