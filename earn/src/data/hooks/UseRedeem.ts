import { BigNumber, ethers } from 'ethers';
import { routerABI } from 'shared/lib/abis/Router';
import { ALOE_II_ROUTER_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN } from 'shared/lib/data/GoodNumber';
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
    address: ALOE_II_ROUTER_ADDRESS[chainId] as Address,
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

  // If the user is trying to redeem more than they have, we'll just redeem the max.
  // This means we won't refetch multiple times if the user enters a number greater than the max.
  const amountToConvert = amount.toBigNumber().lte(maxAmount) ? amount : GN.Q(112);
  const { data: sharesData, isFetching: isFetchingShares } = useContractRead({
    ...erc4626,
    functionName: 'convertToShares',
    args: [amountToConvert.toBigNumber()],
  });
  const shares = sharesData ?? BN0;

  const threshold = maxShares.mul(999).div(1000);
  const shouldRedeemMax = shares.gte(threshold) && maxSharesIsChanging;

  /*//////////////////////////////////////////////////////////////
                            ERC4626 REDEEM
  //////////////////////////////////////////////////////////////*/

  const redeemableShares = shares.lt(maxShares) ? shares : maxShares;
  const { config: configRedeem } = usePrepareContractWrite({
    ...erc4626,
    functionName: 'redeem',
    args: [shouldRedeemMax ? ethers.constants.MaxUint256 : redeemableShares, owner, recipient],
    enabled: redeemableShares.gt(0),
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
    action = redeem;
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
