import { ReactElement, useContext, useEffect, useState } from 'react';

import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { borrowerABI } from 'shared/lib/abis/Borrower';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { FilledGradientButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { ALOE_II_FACTORY_ADDRESS, ALOE_II_FRONTEND_MANAGER_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { Q32 } from 'shared/lib/data/constants/Values';
import { GN } from 'shared/lib/data/GoodNumber';
import useEffectOnce from 'shared/lib/data/hooks/UseEffectOnce';
import { computeOracleSeed } from 'shared/lib/data/OracleSeed';
import { Token } from 'shared/lib/data/Token';
import {
  Address,
  Chain,
  erc20ABI,
  useBalance,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useProvider,
} from 'wagmi';

import { ChainContext } from '../../App';
import { ReactComponent as AlertTriangleIcon } from '../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../assets/svg/check_black.svg';
import { ReactComponent as LoaderIcon } from '../../assets/svg/loader.svg';
import { zip } from '../../data/actions/ActionArgs';
import { getFrontendManagerCodeFor } from '../../data/actions/ActionID';
import { AccountState, ActionCardOutput } from '../../data/actions/Actions';
import { Balances } from '../../data/Balances';
import FailedTxnModal from './modal/FailedTxnModal';
import PendingTxnModal from './modal/PendingTxnModal';
import SuccessfulTxnModal from './modal/SuccessfulTxnModal';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room

enum ConfirmButtonState {
  INSUFFICIENT_ASSET0,
  INSUFFICIENT_ASSET1,
  APPROVE_ASSET0,
  APPROVE_ASSET1,
  NO_ACTIONS,
  ERRORING_ACTIONS,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(
  state: ConfirmButtonState,
  token0: Token,
  token1: Token
): { text: string; Icon: ReactElement; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET0:
      return {
        text: `Insufficient ${token0.symbol}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
      };
    case ConfirmButtonState.INSUFFICIENT_ASSET1:
      return {
        text: `Insufficient ${token1.symbol}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
      };
    case ConfirmButtonState.APPROVE_ASSET0:
      return {
        text: `Approve ${token0.symbol}`,
        Icon: <CheckIcon />,
        enabled: true,
      };
    case ConfirmButtonState.APPROVE_ASSET1:
      return {
        text: `Approve ${token1.symbol}`,
        Icon: <CheckIcon />,
        enabled: true,
      };
    case ConfirmButtonState.LOADING:
    case ConfirmButtonState.NO_ACTIONS:
    case ConfirmButtonState.ERRORING_ACTIONS:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: false };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', Icon: <LoaderIcon />, enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: true };
  }
}

function useAllowance(onChain: Chain, token: Token, owner: Address, spender: Address, enabled: boolean) {
  return useContractRead({
    address: token.address,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [owner, spender],
    chainId: onChain.id,
    enabled: enabled && owner !== '0x',
  });
}

function useAllowanceWrite(onChain: Chain, token: Token, spender: Address, onSuccess?: () => void) {
  return useContractWrite({
    address: token.address,
    abi: erc20ABI,
    chainId: onChain.id,
    mode: 'recklesslyUnprepared',
    functionName: 'approve',
    args: [spender, ethers.constants.MaxUint256],
    onSuccess: onSuccess,
  });
}

export type ManageAccountTransactionButtonProps = {
  userAddress: Address | undefined;
  accountAddress: Address;
  uniswapPool: string;
  token0: Token;
  token1: Token;
  userBalances: Balances;
  accountState: AccountState;
  actionOutputs: ActionCardOutput[];
  transactionWillFail: boolean;
  enabled: boolean;
  onSuccessReceipt: () => void;
};

export function ManageAccountTransactionButton(props: ManageAccountTransactionButtonProps) {
  const {
    userAddress,
    accountAddress,
    uniswapPool,
    token0,
    token1,
    userBalances,
    accountState,
    actionOutputs,
    transactionWillFail,
    enabled,
    onSuccessReceipt,
  } = props;
  const { activeChain } = useContext(ChainContext);

  // modals
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  // transaction state
  const [pendingTxnHash, setPendingTxnHash] = useState<string | undefined>(undefined);
  const [oracleSeed, setOracleSeed] = useState<number | undefined>(undefined);

  const provider = useProvider({ chainId: activeChain.id });
  const navigate = useNavigate();

  const { data: accountEtherBalance, refetch: refetchEtherBalance } = useBalance({
    address: accountAddress,
    chainId: activeChain.id,
    enabled: enabled,
  });

  const { data: userAllowance0Asset, refetch: refetchAllowance0 } = useAllowance(
    activeChain,
    token0,
    userAddress ?? '0x',
    ALOE_II_FRONTEND_MANAGER_ADDRESS[activeChain.id],
    enabled
  );
  const { data: userAllowance1Asset, refetch: refetchAllowance1 } = useAllowance(
    activeChain,
    token1,
    userAddress ?? '0x',
    ALOE_II_FRONTEND_MANAGER_ADDRESS[activeChain.id],
    enabled
  );
  const writeAsset0Allowance = useAllowanceWrite(
    activeChain,
    token0,
    ALOE_II_FRONTEND_MANAGER_ADDRESS[activeChain.id],
    refetchAllowance0
  );
  const writeAsset1Allowance = useAllowanceWrite(
    activeChain,
    token1,
    ALOE_II_FRONTEND_MANAGER_ADDRESS[activeChain.id],
    refetchAllowance1
  );

  useEffectOnce(() => {
    (async () => {
      const seed = await computeOracleSeed(uniswapPool, provider, activeChain.id);
      setOracleSeed(seed);
    })();
  });

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    interval = setInterval(() => {
      refetchEtherBalance();
      refetchAllowance0();
      refetchAllowance1();
    }, 13_000);
    return () => {
      if (interval != null) {
        clearInterval(interval);
      }
    };
  }, [refetchEtherBalance, refetchAllowance0, refetchAllowance1]);

  const requiredBalances = [accountState.requiredAllowances.amount0, accountState.requiredAllowances.amount1];
  const insufficient = [requiredBalances[0].gt(userBalances.amount0), requiredBalances[1].gt(userBalances.amount1)];
  const loadingApprovals = [
    requiredBalances[0].isGtZero() && !userAllowance0Asset,
    requiredBalances[1].isGtZero() && !userAllowance1Asset,
  ];
  const needsApproval = [
    userAllowance0Asset && GN.fromBigNumber(userAllowance0Asset, token0.decimals).lt(requiredBalances[0]),
    userAllowance1Asset && GN.fromBigNumber(userAllowance1Asset, token1.decimals).lt(requiredBalances[1]),
  ];

  if (writeAsset0Allowance.isError) writeAsset0Allowance.reset();
  if (writeAsset1Allowance.isError) writeAsset1Allowance.reset();

  // check whether we're prepared to send a transaction (independent of whether transaction will succeed/fail)
  const canConstructTransaction = actionOutputs.findIndex((o) => o.actionArgs === undefined) === -1;

  const actionIds = actionOutputs.map((o) => getFrontendManagerCodeFor(o.actionId));
  const actionArgs = actionOutputs.map((o) => o.actionArgs!);
  let positions = '0';

  // if Uniswap positions are being changed, make sure to send an updated array of positions
  if (actionIds.includes(4) || actionIds.includes(5)) {
    positions = zip(accountState.uniswapPositions);
  }

  const { data: anteData } = useContractRead({
    abi: factoryAbi,
    address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
    functionName: 'getParameters',
    args: [uniswapPool as Address],
    chainId: activeChain.id,
    enabled: enabled,
  });

  const ante = !anteData ? GN.zero(18) : GN.fromBigNumber(anteData.ante, 18);

  const gnAccountEtherBalance = accountEtherBalance ? GN.fromBigNumber(accountEtherBalance.value, 18) : GN.zero(18);

  // provide ante if necessary
  const shouldProvideAnte =
    accountEtherBalance &&
    gnAccountEtherBalance.lt(ante) &&
    (accountState.liabilities.amount0.isGtZero() || accountState.liabilities.amount1.isGtZero());

  const calldata = canConstructTransaction
    ? ethers.utils.defaultAbiCoder.encode(['uint8[]', 'bytes[]', 'uint144'], [actionIds, actionArgs, positions])
    : null;

  const { config: contractConfig } = usePrepareContractWrite({
    address: accountAddress,
    abi: borrowerABI,
    functionName: 'modify',
    chainId: activeChain.id,
    args: [ALOE_II_FRONTEND_MANAGER_ADDRESS[activeChain.id], calldata as `0x${string}`, oracleSeed ?? Q32],
    overrides: { value: shouldProvideAnte ? ante.recklessAdd(1).toBigNumber() : undefined },
    enabled:
      canConstructTransaction &&
      enabled &&
      !transactionWillFail &&
      !needsApproval[0] &&
      !needsApproval[1] &&
      !!oracleSeed &&
      !!ante,
  });
  const contract = useContractWrite({
    ...contractConfig,
    request: {
      ...contractConfig.request,
      gasLimit: contractConfig?.request?.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100),
    },
  });

  if (contract.isError || contract.isSuccess) setTimeout(contract.reset, 500);

  let confirmButtonState = ConfirmButtonState.READY;
  if (actionOutputs.length === 0) {
    confirmButtonState = ConfirmButtonState.NO_ACTIONS;
  } else if (loadingApprovals.includes(true)) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (!canConstructTransaction || transactionWillFail) {
    confirmButtonState = ConfirmButtonState.ERRORING_ACTIONS;
  } else if (insufficient[0]) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET0;
  } else if (insufficient[1]) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET1;
  } else if (needsApproval[0] && writeAsset0Allowance.isIdle) {
    confirmButtonState = ConfirmButtonState.APPROVE_ASSET0;
  } else if (needsApproval[1] && writeAsset1Allowance.isIdle) {
    confirmButtonState = ConfirmButtonState.APPROVE_ASSET1;
  } else if (needsApproval.includes(true)) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (contract.isIdle) {
    confirmButtonState = ConfirmButtonState.READY;
  } else {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token0, token1);

  return (
    <div>
      <FilledGradientButtonWithIcon
        Icon={confirmButton.Icon}
        position='trailing'
        size='M'
        svgColorType='stroke'
        onClick={() => {
          if (!canConstructTransaction) {
            console.error("Oops! The transaction couldn't be formatted correctly. Please refresh and try again.");
            return;
          }

          switch (confirmButtonState) {
            case ConfirmButtonState.APPROVE_ASSET0:
              writeAsset0Allowance.write?.();
              break;
            case ConfirmButtonState.APPROVE_ASSET1:
              writeAsset1Allowance.write?.();
              break;
            case ConfirmButtonState.READY:
              contract.writeAsync?.().then((txnResult) => {
                setShowPendingModal(true);
                // In this callback, we have a txnResult. This means that the transaction has been submitted
                // to the blockchain and/or the user rejected it entirely. These states correspond to
                // contract.isError and contract.isSuccess, which we deal with elsewhere.
                setPendingTxnHash(txnResult.hash);

                txnResult
                  .wait(1)
                  .then((txnReceipt) => {
                    // In this callback, the transaction has been included on the blockchain and at least 1 block
                    // has been built on top of it.
                    setShowPendingModal(false);
                    setPendingTxnHash(undefined);
                    if (txnReceipt.status === 1) {
                      // TODO in addition to clearing actions here, we should refresh the page to get updated data
                      onSuccessReceipt();
                    }

                    console.log(txnReceipt);

                    setTimeout(() => {
                      //Wait till the other modal is fully closed (since otherwise we will mess up page scrolling)
                      if (txnReceipt.status === 1) setShowSuccessModal(true);
                      else setShowFailedModal(true);
                    }, 500);
                  })
                  .catch((e) => {
                    console.error(e);
                    setShowPendingModal(false);
                    setPendingTxnHash(undefined);
                    setShowFailedModal(true);
                  });
              });
              break;
            default:
              break;
          }
        }}
        disabled={!confirmButton.enabled}
      >
        {confirmButton.text}
      </FilledGradientButtonWithIcon>
      <PendingTxnModal open={showPendingModal} setOpen={setShowPendingModal} txnHash={pendingTxnHash} />
      <FailedTxnModal open={showFailedModal} setOpen={setShowFailedModal} />
      <SuccessfulTxnModal
        open={showSuccessModal}
        setOpen={setShowSuccessModal}
        onConfirm={() => {
          setTimeout(() => navigate(0), 100);
        }}
      />
    </div>
  );
}
