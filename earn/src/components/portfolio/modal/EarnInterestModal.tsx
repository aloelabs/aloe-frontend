import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { Address, useAccount, useBalance, useContractWrite, useProvider, useSigner } from 'wagmi';

import { ChainContext } from '../../../App';
import ERC20ABI from '../../../assets/abis/ERC20.json';
import RouterABI from '../../../assets/abis/Router.json';
import { ReactComponent as AlertTriangleIcon } from '../../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../../assets/svg/check_black.svg';
import { ReactComponent as MoreIcon } from '../../../assets/svg/more_ellipses.svg';
import { ALOE_II_ROUTER_ADDRESS } from '../../../data/constants/Addresses';
import useAllowance from '../../../data/hooks/UseAllowance';
import useAllowanceWrite from '../../../data/hooks/UseAllowanceWrite';
import { Kitty } from '../../../data/Kitty';
import { LendingPair } from '../../../data/LendingPair';
import { Token } from '../../../data/Token';
import { formatNumberInput, roundPercentage, toBig, truncateDecimals } from '../../../util/Numbers';
import { doesSupportPermit, getErc2612Signature } from '../../../util/Permit';
import PairDropdown from '../../common/PairDropdown';
import Tooltip from '../../common/Tooltip';
import TokenAmountSelectInput from '../TokenAmountSelectInput';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  PERMIT_ASSET,
  APPROVE_ASSET,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(
  state: ConfirmButtonState,
  token: Token
): { text: string; Icon: ReactElement; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.ticker}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
      };
    case ConfirmButtonState.PERMIT_ASSET:
      return {
        text: `Permit ${token.ticker}`,
        Icon: <CheckIcon />,
        enabled: true,
      };
    case ConfirmButtonState.APPROVE_ASSET:
      return {
        text: `Approve ${token.ticker}`,
        Icon: <CheckIcon />,
        enabled: true,
      };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', Icon: <MoreIcon />, enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: true };
    case ConfirmButtonState.LOADING:
    default:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: false };
  }
}

type PermitData = {
  signature: ethers.Signature;
  approve: {
    owner: string;
    spender: string;
    value: BigNumberish;
  };
  deadline: BigNumberish;
};

type DepositButtonProps = {
  depositAmount: string;
  depositBalance: string;
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
  const [canUsePermit, setCanUsePermit] = useState<boolean>(false);
  const [permitData, setPermitData] = useState<PermitData | undefined>(undefined);

  const { data: userAllowanceToken } = useAllowance(activeChain, token, accountAddress, ALOE_II_ROUTER_ADDRESS);

  const writeAllowanceToken = useAllowanceWrite(activeChain, token, ALOE_II_ROUTER_ADDRESS);

  const { data: signer } = useSigner();

  const provider = useProvider();

  const {
    write: depositUsingApprovalFlow,
    isSuccess: successfullyDepositedWithApproval,
    isLoading: isLoadingApprovalFlow,
    data: approvalFlowData,
  } = useContractWrite({
    address: ALOE_II_ROUTER_ADDRESS,
    abi: RouterABI,
    mode: 'recklesslyUnprepared',
    functionName: 'depositWithApprove(address,uint256)',
    chainId: activeChain.id,
  });

  const {
    write: depositUsingPermitFlow,
    isSuccess: successfullyDepositedWithPermit,
    isLoading: isLoadingPermitFlow,
    data: permitFlowData,
  } = useContractWrite({
    address: ALOE_II_ROUTER_ADDRESS,
    abi: RouterABI,
    mode: 'recklesslyUnprepared',
    functionName: 'depositWithPermit(address,uint256,uint256,uint256,uint8,bytes32,bytes32)',
    chainId: activeChain.id,
  });

  const erc20Contract = useMemo(() => new ethers.Contract(token.address, ERC20ABI, provider), [token, provider]);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const result = await doesSupportPermit(erc20Contract);
      if (mounted) {
        setCanUsePermit(result);
      }
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [token, provider, erc20Contract]);

  const contractDidSucceed = successfullyDepositedWithApproval || successfullyDepositedWithPermit;
  const contractData = approvalFlowData ?? permitFlowData;
  const contractIsLoading = isLoadingApprovalFlow || isLoadingPermitFlow;

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
      setIsOpen(false);
    } else if (!contractIsLoading && !contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractIsLoading, setPendingTxn, setIsOpen]);

  const numericDepositBalance = Number(depositBalance) || 0;
  const numericDepositAmount = Number(depositAmount) || 0;

  const loadingApproval = numericDepositBalance > 0 && !userAllowanceToken;
  const needsApproval =
    userAllowanceToken && toBig(userAllowanceToken).div(token.decimals).toNumber() < numericDepositBalance;

  let confirmButtonState = ConfirmButtonState.READY;

  if (canUsePermit) {
    if (numericDepositAmount > numericDepositBalance) {
      confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
    } else if (!permitData) {
      confirmButtonState = ConfirmButtonState.PERMIT_ASSET;
    } else if (isPending) {
      confirmButtonState = ConfirmButtonState.PENDING;
    }
  } else {
    if (numericDepositAmount > numericDepositBalance) {
      confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
    } else if (loadingApproval) {
      confirmButtonState = ConfirmButtonState.LOADING;
    } else if (needsApproval && isPending) {
      confirmButtonState = ConfirmButtonState.PENDING;
    } else if (needsApproval) {
      confirmButtonState = ConfirmButtonState.APPROVE_ASSET;
    } else if (isPending) {
      confirmButtonState = ConfirmButtonState.PENDING;
    }
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  function handleClickConfirm() {
    // TODO: Do not use setStates in async functions outside of useEffect
    switch (confirmButtonState) {
      case ConfirmButtonState.APPROVE_ASSET:
        setIsPending(true);
        writeAllowanceToken
          .writeAsync?.()
          .then((txnResult) => {
            txnResult.wait(1).then(() => {
              setIsPending(false);
            });
          })
          .catch((error) => {
            setIsPending(false);
          });
        break;
      case ConfirmButtonState.PERMIT_ASSET:
        setIsPending(true);

        const approve = {
          owner: accountAddress,
          spender: ALOE_II_ROUTER_ADDRESS,
          value: ethers.utils.parseUnits(depositAmount, token.decimals).add(1),
        };
        const deadline = (Date.now() / 1000 + 60 * 5).toFixed(0);

        getErc2612Signature(signer!, activeChain.id, erc20Contract, approve, deadline).then((signature) => {
          setPermitData({ signature, approve, deadline });
          setIsPending(false);
        });

        break;
      case ConfirmButtonState.READY:
        setIsPending(true);

        if (permitData) {
          depositUsingPermitFlow?.({
            recklesslySetUnpreparedArgs: [
              kitty.address,
              ethers.utils.parseUnits(depositAmount, token.decimals).toString(),
              permitData.approve.value,
              permitData.deadline,
              permitData.signature.v,
              permitData.signature.r,
              permitData.signature.s,
            ],
            recklesslySetUnpreparedOverrides: { gasLimit: BigNumber.from('600000') },
          });
        } else {
          depositUsingApprovalFlow?.({
            recklesslySetUnpreparedArgs: [
              kitty.address,
              ethers.utils.parseUnits(depositAmount, token.decimals).toString(),
            ],
            recklesslySetUnpreparedOverrides: { gasLimit: BigNumber.from('600000') },
          });
        }
        break;
      default:
        break;
    }
  }

  const isDepositAmountValid = numericDepositAmount > 0;
  const shouldConfirmButtonBeDisabled =
    !confirmButton.enabled || (confirmButtonState !== ConfirmButtonState.APPROVE_ASSET && !isDepositAmountValid);

  return (
    <FilledStylizedButton
      size='M'
      onClick={() => handleClickConfirm()}
      fillWidth={true}
      disabled={shouldConfirmButtonBeDisabled}
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
  referralCode: number | null;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function EarnInterestModal(props: EarnInterestModalProps) {
  const { isOpen, options, defaultOption, lendingPairs, setIsOpen, setPendingTxn } = props;
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
  const { data: depositBalance } = useBalance({
    addressOrName: account?.address ?? '',
    token: selectedOption.address,
    watch: true,
    chainId: activeChain.id,
  });

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
            depositAmount={inputValue}
            depositBalance={depositBalance?.formatted ?? '0.00'}
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
            By depositing, you agree to our <a href='/earn/public/terms.pdf'>Terms of Service</a> and acknowledge that
            you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is your duty to
            educate yourself and be aware of the risks.
          </Text>
        </div>
      </div>
    </Modal>
  );
}
