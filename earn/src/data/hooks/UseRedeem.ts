import { BigNumber, Signature } from 'ethers';
import { routerABI } from 'shared/lib/abis/Router';
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

import { ALOE_II_ROUTER_ADDRESS } from '../constants/Addresses';

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

export function useRedeem(chainId: number, lender: Address, amount: GN, owner: Address, recipient?: Address) {
  if (!recipient) recipient = owner;

  const erc4626 = {
    address: lender,
    abi: erc4626ABI,
    chainId,
  };

  const router = {
    address: ALOE_II_ROUTER_ADDRESS,
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

  const { data: sharesData, isFetching: isFetchingShares } = useContractRead({
    ...erc4626,
    functionName: 'convertToShares',
    args: [amount.toBigNumber()],
  });

  const [maxAmount, maxShares, maxSharesIsChanging] = maxData ?? [BN0, BN0, false];
  const shares = sharesData ?? BN0;

  const threshold = maxShares.mul(95).div(100);
  const shouldUseChecks = shares.gte(threshold) && maxSharesIsChanging;

  /*//////////////////////////////////////////////////////////////
                            ERC4626 REDEEM
  //////////////////////////////////////////////////////////////*/

  const { config: configRedeem } = usePrepareContractWrite({
    ...erc4626,
    functionName: 'redeem',
    args: [shares, owner, recipient],
    enabled: !shouldUseChecks && shares.gt(0),
  });
  const {
    write: redeem,
    data: redeemTxn,
    isLoading: isAskingUserToRedeem,
  } = useContractWrite({
    ...configRedeem,
    request: {
      ...configRedeem.request,
      gasLimit: configRedeem.request?.gasLimit.mul(110).div(100),
    },
  });

  /*//////////////////////////////////////////////////////////////
                            ROUTER REDEEM
  //////////////////////////////////////////////////////////////*/

  // First, the Router needs permission to spend the user's shares
  const {
    state: permitState,
    action: permitAction,
    result: permitResult,
  } = usePermit(chainId, lender, owner, ALOE_II_ROUTER_ADDRESS, shares.toString(), shouldUseChecks);
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
  } = useContractWrite({
    ...configRedeemWithChecks,
    request: {
      ...configRedeemWithChecks.request,
      gasLimit: configRedeemWithChecks.request?.gasLimit.mul(110).div(100),
    },
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
    maxAmount,
  };
}
