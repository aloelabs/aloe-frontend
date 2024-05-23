import { ReactElement, useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { strictDeepEqual } from 'fast-equals';
import { useNavigate } from 'react-router-dom';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { FilledGradientButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { ALOE_II_FACTORY_ADDRESS, ALOE_II_FRONTEND_MANAGER_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { Q32 } from 'shared/lib/data/constants/Values';
import { GN } from 'shared/lib/data/GoodNumber';
import { computeOracleSeed } from 'shared/lib/data/OracleSeed';
import { Token } from 'shared/lib/data/Token';
import useChain from 'shared/lib/hooks/UseChain';
import useEffectOnce from 'shared/lib/hooks/UseEffectOnce';
import { Address, erc20Abi, maxUint256 } from 'viem';
import {
  Config,
  useBalance,
  useBlockNumber,
  useClient,
  usePublicClient,
  useReadContract,
  useSimulateContract,
  useWriteContract,
} from 'wagmi';

import FailedTxnModal from './modal/FailedTxnModal';
import PendingTxnModal from './modal/PendingTxnModal';
import SuccessfulTxnModal from './modal/SuccessfulTxnModal';
import { ReactComponent as AlertTriangleIcon } from '../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../assets/svg/check_black.svg';
import { ReactComponent as LoaderIcon } from '../../assets/svg/loader.svg';
import { zip } from '../../data/actions/ActionArgs';
import { getFrontendManagerCodeFor } from '../../data/actions/ActionID';
import { AccountState, ActionCardOutput } from '../../data/actions/Actions';
import { Balances } from '../../data/Balances';
import { useEthersProvider } from '../../util/Provider';

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
  const activeChain = useChain();

  // modals
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  // transaction state
  const [pendingTxnHash, setPendingTxnHash] = useState<string | undefined>(undefined);
  const [oracleSeed, setOracleSeed] = useState<number | undefined>(undefined);

  const queryClient = useQueryClient();

  const client = useClient<Config>();
  const provider = useEthersProvider(client);
  const navigate = useNavigate();
  const publicClient = usePublicClient({ chainId: activeChain.id });

  const { data: blockNumber } = useBlockNumber({ watch: true, chainId: activeChain.id });
  const { data: accountEtherBalance, queryKey: queryKeyBalanceEther } = useBalance({
    address: accountAddress,
    chainId: activeChain.id,
    query: { enabled: enabled },
  });
  const { data: userAllowance0Asset, queryKey: queryKeyAllowance0 } = useReadContract({
    abi: erc20Abi,
    address: token0.address,
    functionName: 'allowance',
    args: [userAddress ?? '0x', ALOE_II_FRONTEND_MANAGER_ADDRESS[activeChain.id]],
    chainId: activeChain.id,
    query: { enabled: Boolean(userAddress) },
  });
  const { data: userAllowance1Asset, queryKey: queryKeyAllowance1 } = useReadContract({
    abi: erc20Abi,
    address: token0.address,
    functionName: 'allowance',
    args: [userAddress ?? '0x', ALOE_II_FRONTEND_MANAGER_ADDRESS[activeChain.id]],
    chainId: activeChain.id,
    query: { enabled: Boolean(userAddress) },
  });
  const { writeContract, writeContractAsync } = useWriteContract();

  useEffectOnce(() => {
    (async () => {
      if (!provider) return;
      const seed = await computeOracleSeed(uniswapPool, provider, activeChain.id);
      setOracleSeed(seed);
    })();
  });

  useEffect(() => {
    queryClient.invalidateQueries({
      predicate(query) {
        return (
          strictDeepEqual(query.queryKey, queryKeyBalanceEther) ||
          strictDeepEqual(query.queryKey, queryKeyAllowance0) ||
          strictDeepEqual(query.queryKey, queryKeyAllowance1)
        );
      },
    });
  }, [queryClient, blockNumber, queryKeyBalanceEther, queryKeyAllowance0, queryKeyAllowance1]);

  const requiredBalances = [accountState.requiredAllowances.amount0, accountState.requiredAllowances.amount1];
  const insufficient = [requiredBalances[0].gt(userBalances.amount0), requiredBalances[1].gt(userBalances.amount1)];
  const loadingApprovals = [
    requiredBalances[0].isGtZero() && userAllowance0Asset === undefined,
    requiredBalances[1].isGtZero() && userAllowance1Asset === undefined,
  ];
  const needsApproval = [
    userAllowance0Asset !== undefined && GN.fromBigInt(userAllowance0Asset, token0.decimals).lt(requiredBalances[0]),
    userAllowance1Asset !== undefined && GN.fromBigInt(userAllowance1Asset, token1.decimals).lt(requiredBalances[1]),
  ];

  // check whether we're prepared to send a transaction (independent of whether transaction will succeed/fail)
  const canConstructTransaction = actionOutputs.findIndex((o) => o.actionArgs === undefined) === -1;

  const actionIds = actionOutputs.map((o) => getFrontendManagerCodeFor(o.actionId));
  const actionArgs = actionOutputs.map((o) => o.actionArgs!);
  let positions = '0';

  // if Uniswap positions are being changed, make sure to send an updated array of positions
  if (actionIds.includes(4) || actionIds.includes(5)) {
    positions = zip(accountState.uniswapPositions);
  }

  const { data: anteData } = useReadContract({
    abi: factoryAbi,
    address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
    functionName: 'getParameters',
    args: [uniswapPool as Address],
    chainId: activeChain.id,
    query: { enabled: enabled },
  });

  const ante = !anteData ? GN.zero(18) : GN.fromBigInt(anteData[0], 18);

  const gnAccountEtherBalance = accountEtherBalance ? GN.fromBigInt(accountEtherBalance.value, 18) : GN.zero(18);

  // provide ante if necessary
  const shouldProvideAnte =
    accountEtherBalance &&
    gnAccountEtherBalance.lt(ante) &&
    (accountState.liabilities.amount0.isGtZero() || accountState.liabilities.amount1.isGtZero());

  const calldata = canConstructTransaction
    ? ethers.utils.defaultAbiCoder.encode(['uint8[]', 'bytes[]', 'uint144'], [actionIds, actionArgs, positions])
    : null;

  const { data: contractConfig } = useSimulateContract({
    address: accountAddress,
    abi: borrowerAbi,
    functionName: 'modify',
    chainId: activeChain.id,
    args: [ALOE_II_FRONTEND_MANAGER_ADDRESS[activeChain.id], calldata as `0x${string}`, oracleSeed ?? Q32],
    value: shouldProvideAnte ? ante.recklessAdd(1).toBigInt() : undefined,
    query: {
      enabled:
        canConstructTransaction &&
        enabled &&
        !transactionWillFail &&
        !needsApproval[0] &&
        !needsApproval[1] &&
        Boolean(oracleSeed) &&
        Boolean(ante),
    },
  });

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
  } else if (needsApproval[0]) {
    confirmButtonState = ConfirmButtonState.APPROVE_ASSET0;
  } else if (needsApproval[1]) {
    confirmButtonState = ConfirmButtonState.APPROVE_ASSET1;
  } else if (needsApproval.includes(true)) {
    confirmButtonState = ConfirmButtonState.PENDING;
  } else if (contractConfig?.request) {
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
              writeContract({
                abi: erc20Abi,
                address: token0.address,
                functionName: 'approve',
                args: [ALOE_II_FRONTEND_MANAGER_ADDRESS[activeChain.id], maxUint256],
                chainId: activeChain.id,
              });
              break;
            case ConfirmButtonState.APPROVE_ASSET1:
              writeContract({
                abi: erc20Abi,
                address: token1.address,
                functionName: 'approve',
                args: [ALOE_II_FRONTEND_MANAGER_ADDRESS[activeChain.id], maxUint256],
                chainId: activeChain.id,
              });
              break;
            case ConfirmButtonState.READY:
              if (!publicClient) return;
              writeContractAsync(contractConfig!.request)
                .then(async (hash) => {
                  setShowPendingModal(true);
                  // In this callback, we have a txnResult. This means that the transaction has been submitted
                  // to the blockchain and/or the user rejected it entirely. These states correspond to
                  // contract.isError and contract.isSuccess, which we deal with elsewhere.
                  setPendingTxnHash(hash);

                  const receipt = await publicClient.waitForTransactionReceipt({ hash });
                  setShowPendingModal(false);
                  setPendingTxnHash(undefined);

                  if (receipt.status === 'success') {
                    onSuccessReceipt();
                    setTimeout(() => setShowSuccessModal(true), 500);
                  } else {
                    setTimeout(() => setShowFailedModal(true), 500);
                  }
                })
                .catch((e) => console.error(e));
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
