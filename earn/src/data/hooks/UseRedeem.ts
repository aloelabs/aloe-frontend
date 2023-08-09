import { BigNumber, Signature } from 'ethers';
import { routerABI } from 'shared/lib/abis/Router';
import { ALOE_II_ROUTER_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN } from 'shared/lib/data/GoodNumber';
import { PermitState, usePermit } from 'shared/lib/data/hooks/UsePermit';
import {
  Address,
  erc4626ABI,
  useContractRead,
  useContractReads,
  useContractWrite,
  usePrepareContractWrite,
} from 'wagmi';

export enum RedeemState {
  WAITING_FOR_INPUT,
  FETCHING_DATA,
  READY_TO_SIGN,
  ASKING_USER_TO_SIGN,
  READY_TO_REDEEM,
  ASKING_USER_TO_REDEEM,
}

const PERMIT_STATE_TO_REDEEM_STATE = {
  [PermitState.FETCHING_DATA]: RedeemState.FETCHING_DATA,
  [PermitState.READY_TO_SIGN]: RedeemState.READY_TO_SIGN,
  [PermitState.ASKING_USER_TO_SIGN]: RedeemState.ASKING_USER_TO_SIGN,
  [PermitState.ERROR]: undefined,
  [PermitState.DONE]: undefined,
  [PermitState.DISABLED]: undefined,
};

const BN0 = BigNumber.from('0');
const GAS_LIMIT_CUSHION = 110;

export function useRedeem(chainId: number, lender: Address, amount: GN, owner: Address, recipient?: Address) {
  if (!recipient) recipient = owner;

  const erc4626 = {
    address: lender,
    abi: erc4626ABI,
    chainId,
  };

  const router = {
    address: ALOE_II_ROUTER_ADDRESS as Address,
    abi: routerABI,
    chainId,
  };

  /*//////////////////////////////////////////////////////////////
                              FETCHING
  //////////////////////////////////////////////////////////////*/

  const { data: maxData, isFetching: isFetchingMaxData } = useContractReads({
    contracts: [
      { ...erc4626, functionName: 'maxWithdraw', args: [owner] },
      { ...erc4626, functionName: 'maxRedeem', args: [owner] },
      { ...router, functionName: 'isMaxRedeemDynamic', args: [lender, owner] },
    ] as const,
    allowFailure: false,
  });
  const [maxAmount, maxShares, maxSharesIsChanging] = maxData ?? [BN0, BN0, false];

  // If the user is trying to redeem more than they can, we'll just redeem the max.
  // This means we won't refetch multiple times if the user enters a number greater than the max.
  const amountToConvert = amount.toBigNumber().lte(maxAmount) ? amount : GN.Q(112);
  const { data: sharesData, isFetching: isFetchingShares } = useContractRead({
    ...erc4626,
    functionName: 'convertToShares',
    args: [amountToConvert.toBigNumber()],
  });
  const shares = sharesData ?? BN0;

  const threshold = maxShares.mul(95).div(100);
  const shouldUseChecks = shares.gte(threshold) && maxSharesIsChanging;

  /*//////////////////////////////////////////////////////////////
                            ERC4626 REDEEM
  //////////////////////////////////////////////////////////////*/

  const redeemableShares = shares.lt(maxShares) ? shares : maxShares;
  const { config: configRedeem } = usePrepareContractWrite({
    ...erc4626,
    functionName: 'redeem',
    args: [redeemableShares, owner, recipient],
    enabled: !shouldUseChecks && redeemableShares.gt(0),
  });
  const {
    write: redeem,
    data: redeemTxn,
    isLoading: isAskingUserToRedeem,
    reset: resetRedeemTxn,
  } = useContractWrite({
    ...configRedeem,
    request: configRedeem.request
      ? {
          ...configRedeem.request,
          gasLimit: configRedeem.request?.gasLimit.mul(GAS_LIMIT_CUSHION).div(100),
        }
      : undefined,
  });

  /*//////////////////////////////////////////////////////////////
                            ROUTER REDEEM
  //////////////////////////////////////////////////////////////*/

  // First, the Router needs permission to spend the user's shares
  const {
    state: permitState,
    action: permitAction,
    result: permitResult,
  } = usePermit(chainId, lender, owner, ALOE_II_ROUTER_ADDRESS[chainId], shares.toString(), shouldUseChecks);
  const deadline = BigNumber.from(permitResult.deadline);
  const signature = permitResult.signature ?? ({ v: 0, r: '0x', s: '0x' } as Signature);

  // Next, we set up the actual call
  const { config: configRedeemWithChecks } = usePrepareContractWrite({
    ...router,
    functionName: 'redeemWithChecks',
    args: [lender, shares, deadline, signature.v, signature.r as `0x${string}`, signature.s as `0x${string}`],
    enabled: shouldUseChecks && shares.gt(0) && permitResult.signature !== undefined,
  });
  const {
    write: redeemWithChecks,
    data: redeemWithChecksTxn,
    isLoading: isAskingUserToRedeemWithChecks,
    reset: resetRedeemWithChecksTxn,
  } = useContractWrite({
    ...configRedeemWithChecks,
    request: configRedeemWithChecks.request
      ? {
          ...configRedeemWithChecks.request,
          gasLimit: configRedeemWithChecks.request.gasLimit.mul(GAS_LIMIT_CUSHION).div(100),
        }
      : undefined,
  });

  let state: RedeemState;
  let action: (() => void) | undefined;

  if (amount.isZero()) {
    state = RedeemState.WAITING_FOR_INPUT;
    action = undefined;
  } else if (isFetchingMaxData || isFetchingShares) {
    state = RedeemState.FETCHING_DATA;
    action = undefined;
  } else if (isAskingUserToRedeem || isAskingUserToRedeemWithChecks) {
    state = RedeemState.ASKING_USER_TO_REDEEM;
    action = undefined;
  } else if (!shouldUseChecks) {
    state = RedeemState.READY_TO_REDEEM;
    action = redeem;
  } else {
    state = PERMIT_STATE_TO_REDEEM_STATE[permitState] ?? RedeemState.READY_TO_REDEEM;
    action = permitAction ?? redeemWithChecks;
  }

  return {
    state,
    action,
    txn: redeemTxn ?? redeemWithChecksTxn,
    resetTxn() {
      resetRedeemTxn();
      resetRedeemWithChecksTxn();
    },
    maxAmount,
  };
}
