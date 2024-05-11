import { lenderLensAbi } from 'shared/lib/abis/LenderLens';
import { ALOE_II_LENDER_LENS_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN } from 'shared/lib/data/GoodNumber';
import { Address, erc4626Abi, maxUint256 } from 'viem';
import {
  useReadContract,
  useReadContracts,
  useSimulateContract,
  useWriteContract,
} from 'wagmi';

import { ZERO_ADDRESS } from '../constants/Addresses';

export enum RedeemState {
  WAITING_FOR_INPUT,
  FETCHING_DATA,
  READY_TO_SIGN,
  ASKING_USER_TO_SIGN,
  READY_TO_REDEEM,
  ASKING_USER_TO_REDEEM,
}

export function useRedeem(
  chainId: number,
  lender: Address | undefined,
  amount: GN,
  owner: Address,
  recipient?: Address
) {
  if (!recipient) recipient = owner;

  const erc4626 = {
    address: lender,
    abi: erc4626Abi,
    chainId,
  };

  const lenderLens = {
    address: ALOE_II_LENDER_LENS_ADDRESS[chainId] as Address,
    abi: lenderLensAbi,
    chainId,
  };

  /*//////////////////////////////////////////////////////////////
                              FETCHING
  //////////////////////////////////////////////////////////////*/

  const { data: maxData, isFetching: isFetchingMaxData } = useReadContracts({
    contracts: [
      { ...erc4626, functionName: 'maxWithdraw', args: [owner] },
      { ...erc4626, functionName: 'maxRedeem', args: [owner] },
      { ...lenderLens, functionName: 'isMaxRedeemDynamic', args: [lender ?? ZERO_ADDRESS, owner] },
    ] as const,
    allowFailure: false,
    query: { enabled: lender !== undefined },
  });
  const [maxAmount, maxShares, maxSharesIsChanging] = maxData ?? [0n, 0n, false];

  // If the user is trying to redeem more than they have, we'll just redeem the max.
  // This means we won't refetch multiple times if the user enters a number greater than the max.
  const amountToConvert = amount.toBigNumber().lte(maxAmount) ? amount : GN.Q(112);
  const { data: sharesData, isFetching: isFetchingShares } = useReadContract({
    ...erc4626,
    functionName: 'convertToShares',
    args: [amountToConvert.toBigInt()],
    query: { enabled: lender !== undefined },
  });
  const shares = sharesData ?? 0n;

  const threshold = maxShares * 999n / 1000n;
  const shouldRedeemMax = shares >= threshold && maxSharesIsChanging;

  /*//////////////////////////////////////////////////////////////
                            ERC4626 REDEEM
  //////////////////////////////////////////////////////////////*/

  const redeemableShares = shares < maxShares ? shares : maxShares;
  const { data: configRedeem } = useSimulateContract({
    ...erc4626,
    functionName: 'redeem',
    args: [shouldRedeemMax ? maxUint256 : redeemableShares, owner, recipient],
    query: { enabled: redeemableShares > 0 },
  });
  const {
    writeContract: redeem,
    data: redeemTxn,
    isPending: isAskingUserToRedeem,
    reset: resetRedeemTxn,
  } = useWriteContract();

  let state: RedeemState;
  let action: (() => void) | undefined;

  if (amount.isZero()) {
    state = RedeemState.WAITING_FOR_INPUT;
    action = undefined;
  } else if (isFetchingMaxData || isFetchingShares) {
    state = RedeemState.FETCHING_DATA;
    action = undefined;
  } else if (isAskingUserToRedeem) {
    state = RedeemState.ASKING_USER_TO_REDEEM;
    action = undefined;
  } else {
    state = RedeemState.READY_TO_REDEEM;
    if (configRedeem) action = () => redeem(configRedeem.request);
    else action = undefined;
  }

  return {
    state,
    action,
    txn: redeemTxn,
    resetTxn() {
      resetRedeemTxn();
    },
    maxAmount,
  };
}
