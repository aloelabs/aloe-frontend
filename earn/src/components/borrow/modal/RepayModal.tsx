import { useContext, useState, useMemo, useEffect } from 'react';

import { SendTransactionResult, FetchBalanceResult } from '@wagmi/core';
import { ethers, BigNumber } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import {
  useAccount,
  usePrepareContractWrite,
  useContractWrite,
  useBalance,
  Address,
  Chain,
  useSigner,
  useProvider,
} from 'wagmi';

import { ChainContext } from '../../../App';
import ERC20ABI from '../../../assets/abis/ERC20.json';
import RouterABI from '../../../assets/abis/Router.json';
import { ALOE_II_ROUTER_ADDRESS } from '../../../data/constants/Addresses';
import useAllowance from '../../../data/hooks/UseAllowance';
import useAllowanceWrite from '../../../data/hooks/UseAllowanceWrite';
import { MarginAccount } from '../../../data/MarginAccount';
import { Token } from '../../../data/Token';
import { formatNumberInput, truncateDecimals } from '../../../util/Numbers';
import { attemptToInferPermitDomain, EIP2612Domain, getErc2612Signature } from '../../../util/Permit';
import TokenAmountSelectInput from '../../portfolio/TokenAmountSelectInput';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_FUNDS,
  REPAYING_TOO_MUCH,
  PERMIT_ASSET,
  APPROVE_ASSET,
  PENDING,
  READY_VIA_PERMIT,
  READY_VIA_APPROVE,
  DISABLED,
}

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_FUNDS:
      return { text: `Insufficient ${token.ticker}`, enabled: false };
    case ConfirmButtonState.REPAYING_TOO_MUCH:
      return { text: 'Repaying too much', enabled: false };
    case ConfirmButtonState.PERMIT_ASSET:
      return { text: `Permit ${token.ticker}`, enabled: true };
    case ConfirmButtonState.APPROVE_ASSET:
      return { text: `Approve ${token.ticker}`, enabled: true };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.READY_VIA_PERMIT:
    case ConfirmButtonState.READY_VIA_APPROVE:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type PermitData = {
  signature: ethers.Signature;
  approve: {
    owner: string;
    spender: string;
    value: BigNumber;
  };
  deadline: string;
};

type RepayButtonProps = {
  activeChain: Chain;
  marginAccount: MarginAccount;
  userAddress: Address;
  lender: Address;
  repayAmount: string;
  repayToken: Token;
  repayTokenBalance: FetchBalanceResult | undefined;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: SendTransactionResult | null) => void;
};

function RepayButton(props: RepayButtonProps) {
  const {
    activeChain,
    marginAccount,
    userAddress,
    lender,
    repayAmount,
    repayToken,
    repayTokenBalance,
    setIsOpen,
    setPendingTxn,
  } = props;

  const [isPending, setIsPending] = useState(false);
  const [permitDomain, setPermitDomain] = useState<EIP2612Domain | null>(null);
  const [permitData, setPermitData] = useState<PermitData | undefined>(undefined);

  // MARK: wagmi basics -----------------------------------------------------------------------------------------------
  const { data: signer } = useSigner({ chainId: activeChain.id });
  const provider = useProvider({ chainId: activeChain.id });
  const erc20Contract = useMemo(
    () => new ethers.Contract(repayToken.address, ERC20ABI, provider),
    [repayToken, provider]
  );

  // MARK: Infer EIP2612 domain ---------------------------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const result = await attemptToInferPermitDomain(erc20Contract, activeChain.id);
      if (mounted) setPermitDomain(result);
    }
    fetch();
    return () => {
      mounted = false;
    };
  }, [erc20Contract, activeChain.id]);

  // MARK: Read/write hooks for Router's allowance --------------------------------------------------------------------
  const { refetch: refetchRouterAllowance, data: routerAllowance } = useAllowance(
    activeChain,
    repayToken,
    userAddress,
    ALOE_II_ROUTER_ADDRESS
  );
  const writeRouterAllowanceMax = useAllowanceWrite(activeChain, repayToken, ALOE_II_ROUTER_ADDRESS);

  // MARK: Preparing data that's necessary to figure out button state -------------------------------------------------
  const existingLiability = marginAccount.liabilities[lender === marginAccount.lender0 ? 'amount0' : 'amount1'];
  const bigExistingLiability = ethers.utils.parseUnits(existingLiability.toString(), repayToken.decimals);
  const bigRepayAmount = ethers.utils.parseUnits(repayAmount === '' ? '0' : repayAmount, repayToken.decimals);

  // MARK: Determining button state -----------------------------------------------------------------------------------
  let confirmButtonState: ConfirmButtonState;

  if (repayAmount === '') {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (bigRepayAmount.gt(repayTokenBalance?.value ?? BigNumber.from('0'))) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_FUNDS;
  } else if (bigRepayAmount.gt(bigExistingLiability)) {
    confirmButtonState = ConfirmButtonState.REPAYING_TOO_MUCH;
  } else if (permitDomain !== null) {
    if (!permitData) {
      confirmButtonState = ConfirmButtonState.PERMIT_ASSET;
    } else {
      confirmButtonState = ConfirmButtonState.READY_VIA_PERMIT;
    }
  } else if (permitDomain === null && routerAllowance) {
    if (routerAllowance.lt(bigRepayAmount)) {
      confirmButtonState = ConfirmButtonState.APPROVE_ASSET;
    } else {
      confirmButtonState = ConfirmButtonState.READY_VIA_APPROVE;
    }
  } else {
    console.error('Unexpected confirm button state!');
    confirmButtonState = ConfirmButtonState.DISABLED;
  }

  // MARK: Prepare contract write for approval flow -------------------------------------------------------------------
  const { config: repayWithApprovalConfig, refetch: refetchRepayWithApprovalConfig } = usePrepareContractWrite({
    address: ALOE_II_ROUTER_ADDRESS,
    abi: RouterABI,
    functionName: 'repay(address,uint256,address)',
    args: [lender, bigRepayAmount, marginAccount.address],
    chainId: activeChain.id,
    enabled: confirmButtonState === ConfirmButtonState.READY_VIA_APPROVE,
  });
  if (repayWithApprovalConfig.request) {
    repayWithApprovalConfig.request.gasLimit = repayWithApprovalConfig.request.gasLimit
      .mul(GAS_ESTIMATE_WIGGLE_ROOM)
      .div(100);
  }
  const {
    write: repayWithApproval,
    isSuccess: repayWithApprovalDidSucceed,
    isLoading: repayWithApprovalIsLoading,
    data: repayWithApprovalData,
  } = useContractWrite(repayWithApprovalConfig);

  // MARK: Prepare contract write for permit flow ---------------------------------------------------------------------
  const { config: repayWithPermitConfig, refetch: refetchRepayWithPermitConfig } = usePrepareContractWrite({
    address: ALOE_II_ROUTER_ADDRESS,
    abi: RouterABI,
    functionName: 'repayWithPermit(address,uint256,address,uint256,uint256,uint8,bytes32,bytes32)',
    args: [
      lender,
      bigRepayAmount,
      marginAccount.address,
      permitData?.approve.value,
      permitData?.deadline,
      permitData?.signature.v,
      permitData?.signature.r,
      permitData?.signature.s,
    ],
    chainId: activeChain.id,
    enabled: confirmButtonState === ConfirmButtonState.READY_VIA_PERMIT,
  });
  if (repayWithPermitConfig.request) {
    repayWithPermitConfig.request.gasLimit = repayWithPermitConfig.request.gasLimit
      .mul(GAS_ESTIMATE_WIGGLE_ROOM)
      .div(100);
  }
  const {
    write: repayWithPermit,
    isSuccess: repayWithPermitDidSucceed,
    isLoading: repayWithPermitIsLoading,
    data: repayWithPermitData,
  } = useContractWrite(repayWithPermitConfig);

  // MARK: Respond to repay txn successes/failures --------------------------------------------------------------------
  const contractDidSucceed = repayWithApprovalDidSucceed || repayWithPermitDidSucceed;
  const contractIsLoading = repayWithApprovalIsLoading || repayWithPermitIsLoading;
  const contractData = repayWithApprovalData ?? repayWithPermitData;
  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
      setIsOpen(false);
    } else if (!contractIsLoading && !contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractIsLoading, setPendingTxn, setIsOpen]);

  // MARK: Get the button itself --------------------------------------------------------------------------------------
  // --> UI
  const confirmButton = getConfirmButton(confirmButtonState, repayToken);
  // --> action
  const confirmButtonAction = () => {
    switch (confirmButtonState) {
      case ConfirmButtonState.APPROVE_ASSET:
        setIsPending(true);
        writeRouterAllowanceMax
          .writeAsync?.()
          .then((txnResult) =>
            txnResult.wait(1).then(() => {
              refetchRouterAllowance();
            })
          )
          .finally(() => {
            setIsPending(false);
          });
        break;
      case ConfirmButtonState.PERMIT_ASSET:
        setIsPending(true);

        const approve = {
          owner: userAddress,
          spender: ALOE_II_ROUTER_ADDRESS,
          value: bigRepayAmount.add(1),
        };
        const deadline = (Date.now() / 1000 + 60 * 5).toFixed(0);

        getErc2612Signature(signer!, erc20Contract, permitDomain!, approve, deadline).then((signature) => {
          setPermitData({ signature, approve, deadline });
          setIsPending(false);
        });
        break;
      case ConfirmButtonState.READY_VIA_APPROVE:
        setIsPending(true);
        if (!repayWithApprovalConfig.request) {
          console.error('Reached READY state before approval config was ready');
          refetchRepayWithApprovalConfig();
        } else repayWithApproval?.();
        break;
      case ConfirmButtonState.READY_VIA_PERMIT:
        setIsPending(true);
        if (!repayWithPermitConfig.request) {
          console.error('Reached READY state before permit config was ready');
          refetchRepayWithPermitConfig();
        } else repayWithPermit?.();
        break;
      default:
        break;
    }
  };

  return (
    <FilledStylizedButton size='M' fillWidth={true} disabled={!confirmButton.enabled} onClick={confirmButtonAction}>
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type RepayModalProps = {
  marginAccount: MarginAccount;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function RepayModal(props: RepayModalProps) {
  const { marginAccount, isOpen, setIsOpen, setPendingTxn } = props;

  const { activeChain } = useContext(ChainContext);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayToken, setRepayToken] = useState<Token>(marginAccount.token0);

  const { address: userAddress } = useAccount();
  const { data: repayTokenBalance } = useBalance({
    address: userAddress,
    chainId: activeChain.id,
    token: repayToken.address,
    watch: false,
  });
  const bigTokenBalance = repayTokenBalance?.value ?? BigNumber.from('0');

  // Reset repay amount and token when modal is opened/closed or when the margin account token0 changes
  useEffect(() => {
    setRepayAmount('');
    setRepayToken(marginAccount.token0);
  }, [isOpen, marginAccount.token0]);

  const existingLiability =
    repayToken.address === marginAccount.token0.address
      ? marginAccount.liabilities.amount0
      : marginAccount.liabilities.amount1;
  const bigExistingLiability = ethers.utils.parseUnits(existingLiability.toString(), repayToken.decimals);
  const bigRepayAmount = ethers.utils.parseUnits(repayAmount === '' ? '0' : repayAmount, repayToken.decimals);
  const bigRemainingLiability = bigExistingLiability.sub(bigRepayAmount);

  const maxRepay = bigExistingLiability.lte(bigTokenBalance) ? bigExistingLiability : bigTokenBalance;

  if (!userAddress || !isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} title='Repay' setIsOpen={setIsOpen} maxHeight='650px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Amount
            </Text>
            <BaseMaxButton
              size='L'
              onClick={() => {
                setRepayAmount(ethers.utils.formatUnits(maxRepay, repayToken.decimals));
              }}
            >
              MAX
            </BaseMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={repayAmount}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, repayToken.decimals);
                setRepayAmount(truncatedOutput);
              }
            }}
            onSelect={(option: Token) => {
              setRepayAmount('');
              setRepayToken(option);
            }}
            options={[marginAccount.token0, marginAccount.token1]}
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
              {repayAmount || '0'} {repayToken.ticker}
            </strong>
            . This will increase your smart wallet's health and bring remaining borrows down to{' '}
            <strong>
              {ethers.utils.formatUnits(bigRemainingLiability, repayToken.decimals)} {repayToken.ticker}
            </strong>
            .
          </Text>
        </div>
        <div className='w-full'>
          <RepayButton
            activeChain={activeChain}
            marginAccount={marginAccount}
            userAddress={userAddress}
            lender={repayToken.address === marginAccount.token0.address ? marginAccount.lender0 : marginAccount.lender1}
            repayAmount={repayAmount}
            repayToken={repayToken}
            repayTokenBalance={repayTokenBalance}
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
