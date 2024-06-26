import { useEffect, useMemo, useState } from 'react';

import {
  useReadContract,
  useSignTypedData,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';

import { permit2Abi } from '../abis/Permit2';
import { bigIntToBinary } from '../util/Bitmap';
import { GN, GNFormat } from '../data/GoodNumber';
import { computeDomainSeparator } from '../util/Permit';
import { UNISWAP_PERMIT2_ADDRESS } from '../data/constants/ChainSpecific';
import { Token } from '../data/Token';
import { Address, Chain, erc20Abi, maxUint256 } from 'viem';
import { parseErc6492Signature } from 'viem/experimental';

export enum Permit2State {
  FETCHING_DATA,
  READY_TO_APPROVE,
  ASKING_USER_TO_APPROVE,
  WAITING_FOR_TRANSACTION,
  READY_TO_SIGN,
  ASKING_USER_TO_SIGN,
  DONE,
}

type uint256 = string;
type address = string;

type TokenPermissions = {
  /**
   * ERC20 token address
   */
  token: address;
  /**
   * the maximum amount that can be spent
   */
  amount: uint256;
};

type PermitTransferFrom = {
  permitted: TokenPermissions;
  /**
   * the address that should be allowed to spend the tokens
   */
  spender: address;
  /**
   * a unique value for every token owner's signature to prevent signature replays
   */
  nonce: uint256;
  /**
   * deadline on the permit signature
   */
  deadline: uint256;
};

const PERMIT2_MESSAGE_TYPES = {
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

const Q248 = `0x1${'0'.repeat(248 / 4)}`;

const REFETCH_INTERVAL = 10_000; // milliseconds

const SIGNATURE_SHELF_LIFE = 10 * 60; // seconds

// eslint-disable-next-line max-len
// Permit2 uses a weirdly complicated [nonce schema](https://docs.uniswap.org/contracts/permit2/reference/signature-transfer#nonce-schema).
// Instead of a counter, a nonce is actually an entry in one of the user's 256-bit bitmaps. Each user has 2^248
// unique bitmaps, and the `wordPos` indicates which one we're dealing with. `wordPos` should be in the range
// [0, 2^248). When a nonce is used, it is flipped *on* in the bitmap.
const DEFAULT_NONCE_WORD_POS = BigInt('0xA10E');

function evmCurrentTimePlus(secondsFromNow: number) {
  return (Date.now() / 1000 + secondsFromNow).toFixed(0);
}

export function usePermit2(chain: Chain, token: Token, owner: Address, spender: Address, amount: GN) {
  /*//////////////////////////////////////////////////////////////
                            REACT STATE
  //////////////////////////////////////////////////////////////*/

  const [deadline, setDeadline] = useState<uint256>(evmCurrentTimePlus(SIGNATURE_SHELF_LIFE));
  const [nonceWordPos, setNonceWordPos] = useState<bigint>(DEFAULT_NONCE_WORD_POS);
  const [nonce, setNonce] = useState<uint256 | null>(null);

  /*//////////////////////////////////////////////////////////////
                          ALLOWANCE HOOKS
  //////////////////////////////////////////////////////////////*/

  // Fetch the user's `allowance`, i.e. how many tokens the Permit2 contract can spend on their behalf
  const {
    data: allowance,
    refetch: refetchAllowance,
    isFetching: isFetchingAllowance,
  } = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, UNISWAP_PERMIT2_ADDRESS[chain.id]] as const,
    chainId: chain.id,
  });

  // Since Permit2 is going to be moving `amount` from the user into Aloe, `allowance` must be at least
  // as big as `amount`. If it's not, the user needs to `approve` more spending.
  const shouldApprove = allowance !== undefined && allowance < amount.toBigInt();

  // Set up the `approve` transaction (only enabled if `shouldApprove` is true)
  const { data: configWriteAllowance } = useSimulateContract({
    address: token.address,
    abi: erc20Abi,
    functionName: 'approve',
    args: [UNISWAP_PERMIT2_ADDRESS[chain.id], maxUint256],
    chainId: chain.id,
    query: { enabled: shouldApprove },
  });
  const {
    writeContract: writeAllowance,
    data: writeAllowanceTxn,
    isPending: isAskingUserToWriteAllowance,
  } = useWriteContract();

  const { data: allowanceReceipt } = useWaitForTransactionReceipt({
    confirmations: 1,
    hash: writeAllowanceTxn,
    chainId: chain.id,
  });

  useEffect(() => {
    if (allowanceReceipt === undefined) return;
    console.debug('writeAllowance transaction successful!', allowanceReceipt);
    refetchAllowance();
  }, [allowanceReceipt, refetchAllowance]);

  /*//////////////////////////////////////////////////////////////
                            PERMIT HOOKS
  //////////////////////////////////////////////////////////////*/

  /*
  Aside from the `amount`, `token` address, and other values that were passed into this hook,
  we need 3 things to generate a Permit2 signature:
  - domain
  - nonce
  - deadline
  */

  // The EIP712 domain of the Permit2 contract. Use `as const` to make wagmi happy.
  const domain = {
    name: 'Permit2',
    chainId: chain.id,
    verifyingContract: UNISWAP_PERMIT2_ADDRESS[chain.id],
  } as const;

  // Verify that `domain` will produce the same domain separator that's stored in the contract.
  // This _should_ always be the case, but it's good to check our work.
  {
    const { data: domainSeparator } = useReadContract({
      address: UNISWAP_PERMIT2_ADDRESS[chain.id],
      abi: permit2Abi,
      functionName: 'DOMAIN_SEPARATOR',
      chainId: chain.id,
    });

    if (domainSeparator && domainSeparator !== computeDomainSeparator(domain)) {
      console.debug('domain', domain, 'domainSeparator', domainSeparator);
      throw new Error(`Permit2 on ${chain.name} is reporting an unexpected DOMAIN_SEPARATOR`);
    }
  }

  // Fetch one of the user's nonce bitmaps
  const {
    data: nonceBitmap,
    refetch: refetchNonceBitmap,
    isFetching: isFetchingNonceBitmap,
  } = useReadContract({
    address: UNISWAP_PERMIT2_ADDRESS[chain.id],
    abi: permit2Abi,
    functionName: 'nonceBitmap',
    args: [owner, nonceWordPos],
    chainId: chain.id,
  });

  // Search through `nonceBitmap` for valid nonces. If there aren't any, jump forward to the
  // next bitmap by incrementing `nonceWordPos`
  useEffect(() => {
    if (nonceBitmap === undefined) return;

    if (nonceBitmap === maxUint256) {
      // NOTE: Selecting `nonceWordPos` randomly may help us find a valid nonce more quickly. However,
      // it would also increase the likelihood of dirtying a completely-clean slot -- in other words,
      // taking it from zero --> non-zero. To save the user gas, we cycle through bitmaps in an orderly
      // fashion so that (in most cases) storage writes are non-zero --> non-zero.
      setNonceWordPos((prev) => (prev + 1n) % BigInt(Q248));
      return;
    }

    const nonceBitmapStr = bigIntToBinary(nonceBitmap).padStart(256, '0');
    const nonceBitPos = 255 - nonceBitmapStr.lastIndexOf('0');

    setNonce(((nonceWordPos << 8n) + BigInt(nonceBitPos)).toString(10));
  }, [nonceBitmap, nonceWordPos]);

  /*//////////////////////////////////////////////////////////////
                              REFRESHING
  //////////////////////////////////////////////////////////////*/

  // Refetch the `allowance` and `nonceBitmap` every `REFETCH_INTERVAL` milliseconds. Important for
  // detecting when an `approve` transaction goes through *and* when the user dirties a nonce on
  // another frontend (e.g. the Uniswap web app).
  useEffect(() => {
    const interval = setInterval(() => {
      refetchAllowance();
      refetchNonceBitmap();
    }, REFETCH_INTERVAL);

    return () => clearInterval(interval);
  });

  // Keep deadline fresh
  useEffect(() => {
    const interval = setInterval(
      () => setDeadline(evmCurrentTimePlus(SIGNATURE_SHELF_LIFE)),
      (SIGNATURE_SHELF_LIFE * 1000) / 4
    );

    return () => clearInterval(interval);
  });

  /*//////////////////////////////////////////////////////////////
                              SIGNING
  //////////////////////////////////////////////////////////////*/

  const amountStr = useMemo(() => amount.toString(GNFormat.INT), [amount]);
  const permitTransferFrom: PermitTransferFrom | undefined = useMemo(() => {
    if (nonce == null) return undefined;
    return {
      permitted: {
        token: token.address,
        amount: amountStr,
      },
      spender: spender,
      nonce: nonce,
      deadline: deadline,
    };
  }, [token.address, amountStr, spender, nonce, deadline]);

  const { signTypedData, isPending: isAskingUserToSign, data: signature, reset: resetSignature } = useSignTypedData();

  useEffect(() => {
    resetSignature();
  }, [resetSignature, permitTransferFrom]);

  // parse signature, in case encoded with extra ERC-6492 data
  const parsedSignature = useMemo(() => {
    if (!signature) return;
    return parseErc6492Signature(signature).signature;
  }, [signature]);

  let state: Permit2State;
  let action: (() => void) | undefined;

  if (isFetchingAllowance || isFetchingNonceBitmap || permitTransferFrom === undefined) {
    state = Permit2State.FETCHING_DATA;
    action = undefined;
  } else if (writeAllowanceTxn && allowanceReceipt) {
    state = Permit2State.WAITING_FOR_TRANSACTION;
    action = undefined;
  } else if (isAskingUserToWriteAllowance) {
    state = Permit2State.ASKING_USER_TO_APPROVE;
    action = undefined;
  } else if (shouldApprove) {
    state = Permit2State.READY_TO_APPROVE;
    action = configWriteAllowance ? () => writeAllowance(configWriteAllowance.request) : undefined;
  } else if (isAskingUserToSign) {
    state = Permit2State.ASKING_USER_TO_SIGN;
    action = undefined;
  } else if (parsedSignature === undefined) {
    state = Permit2State.READY_TO_SIGN;
    action = () =>
      signTypedData({
        domain,
        types: PERMIT2_MESSAGE_TYPES,
        primaryType: 'PermitTransferFrom',
        message: permitTransferFrom,
      });
  } else {
    state = Permit2State.DONE;
    action = undefined;
  }

  return {
    state,
    action,
    result: {
      amount,
      nonce,
      deadline,
      signature: parsedSignature,
    },
  };
}
