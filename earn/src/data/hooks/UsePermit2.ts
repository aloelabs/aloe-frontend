import { useEffect, useState } from 'react';

import { BigNumber, ethers } from 'ethers';
import {
  Address,
  Chain,
  erc20ABI,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useSignTypedData,
} from 'wagmi';

import { permit2ABI } from '../../abis/Permit2';
import { firstZeroBitIn } from '../../util/Bitmap';
import { GN, GNFormat } from '../../util/GoodNumber';
import { computeDomainSeparator } from '../../util/Permit';
import { UNISWAP_PERMIT2_ADDRESS } from '../constants/Addresses';
import { Token } from '../Token';

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
const DEFAULT_NONCE_WORD_POS = BigNumber.from('0xA10E');

function evmCurrentTimePlus(secondsFromNow: number) {
  return (Date.now() / 1000 + secondsFromNow).toFixed(0);
}

export default function usePermit2(chain: Chain, token: Token, owner: Address, spender: Address, amount: GN) {
  /*//////////////////////////////////////////////////////////////
                            REACT STATE
  //////////////////////////////////////////////////////////////*/

  const [deadline, setDeadline] = useState<uint256>(evmCurrentTimePlus(SIGNATURE_SHELF_LIFE));
  const [nonceWordPos, setNonceWordPos] = useState<BigNumber>(DEFAULT_NONCE_WORD_POS);
  const [nonce, setNonce] = useState<uint256 | null>(null);

  /*//////////////////////////////////////////////////////////////
                          ALLOWANCE HOOKS
  //////////////////////////////////////////////////////////////*/

  // Fetch the user's `allowance`, i.e. how many tokens the Permit2 contract can spend on their behalf
  const { data: allowance, refetch: refetchAllowance } = useContractRead({
    address: token.address,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [owner, UNISWAP_PERMIT2_ADDRESS] as const,
    chainId: chain.id,
  });

  // Since Permit2 is going to be moving `amount` from the user into Aloe, `allowance` must be at least
  // as big as `amount`. If it's not, the user needs to `approve` more spending.
  const shouldApprove = allowance !== undefined && allowance.lt(amount.toBigNumber());

  // Set up the `approve` transaction (only enabled if `shouldApprove` is true)
  const { config: configWriteAllowance } = usePrepareContractWrite({
    address: token.address,
    abi: erc20ABI,
    functionName: 'approve',
    args: [UNISWAP_PERMIT2_ADDRESS, ethers.constants.MaxUint256],
    chainId: chain.id,
    enabled: shouldApprove,
  });
  const { write: writeAllowance, isLoading: isLoading0 } = useContractWrite(configWriteAllowance);

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
    verifyingContract: UNISWAP_PERMIT2_ADDRESS,
  } as const;

  // Verify that `domain` will produce the same domain separator that's stored in the contract.
  // This _should_ always be the case, but it's good to check our work.
  {
    const { data: domainSeparator } = useContractRead({
      address: UNISWAP_PERMIT2_ADDRESS,
      abi: permit2ABI,
      functionName: 'DOMAIN_SEPARATOR',
      chainId: chain.id,
      enabled: !shouldApprove,
    });

    if (computeDomainSeparator(domain) !== domainSeparator && domainSeparator !== undefined) {
      console.log('domain', domain, 'domainSeparator', domainSeparator);
      throw new Error(`Permit2 on ${chain.name} is reporting an unexpected DOMAIN_SEPARATOR`);
    }
  }

  // Fetch one of the user's nonce bitmaps (only enabled if user has finished `approve`ing)
  const { data: nonceBitmap, refetch: refetchNonceBitmap } = useContractRead({
    address: UNISWAP_PERMIT2_ADDRESS,
    abi: permit2ABI,
    functionName: 'nonceBitmap',
    args: [owner, BigNumber.from(nonceWordPos)],
    chainId: chain.id,
    enabled: !shouldApprove,
  });

  // Search through `nonceBitmap` for valid nonces. If there aren't any, jump forward to the
  // next bitmap by incrementing `nonceWordPos`
  useEffect(() => {
    if (!nonceBitmap) return;

    if (nonceBitmap.eq(ethers.constants.MaxUint256)) {
      // NOTE: Selecting `nonceWordPos` randomly may help us find a valid nonce more quickly. However,
      // it would also increase the likelihood of dirtying a completely-clean slot -- in other words,
      // taking it from zero --> non-zero. To save the user gas, we cycle through bitmaps in an orderly
      // fashion so that (in most cases) storage writes are non-zero --> non-zero.
      setNonceWordPos((prev) => prev.add(1).mod(Q248));
      return;
    }

    const nonceBitPos = `0x${firstZeroBitIn(nonceBitmap).toString(16)}`;
    const nonce = nonceWordPos.shl(8).add(nonceBitPos);

    setNonce(nonce.toString());
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
      setDeadline((prev) => {
        const remainingShelfLife = Number(prev) - Date.now() / 1000;
        if (remainingShelfLife < SIGNATURE_SHELF_LIFE / 2) {
          return evmCurrentTimePlus(SIGNATURE_SHELF_LIFE);
        }
        return prev;
      });
    }, REFETCH_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  });

  /*//////////////////////////////////////////////////////////////
                              SIGNING
  //////////////////////////////////////////////////////////////*/

  const permitTransferFrom: PermitTransferFrom = {
    permitted: {
      token: token.address,
      amount: amount.toString(GNFormat.INT),
    },
    spender: spender,
    nonce: nonce ?? '0',
    deadline: deadline,
  };

  const {
    signTypedData,
    isLoading: isLoading1,
    data: signature,
  } = useSignTypedData({
    domain,
    types: PERMIT2_MESSAGE_TYPES,
    value: permitTransferFrom,
  });

  const steps = [writeAllowance, signTypedData] as const;
  const nextStep = shouldApprove ? 0 : 1;

  return {
    steps,
    nextStep,
    isLoading: isLoading0 || isLoading1,
    result: {
      amount,
      nonce,
      deadline,
      signature,
    },
  };
}
