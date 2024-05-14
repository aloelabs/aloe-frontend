import { useReadContracts, useSignTypedData } from 'wagmi';
import { useEffect, useMemo, useState } from 'react';
import { erc20Abi } from '../../abis/ERC20';
import { computeDomainSeparator } from '../../util/Permit';
import { splitSignature } from 'ethers/lib/utils.js';
import { Address } from 'viem';

export enum PermitState {
  FETCHING_DATA,
  READY_TO_SIGN,
  ASKING_USER_TO_SIGN,
  ERROR,
  DONE,
  DISABLED,
}

type uint256 = string;
type address = string;

type Permit = {
  owner: address;
  spender: address;
  value: uint256;
  nonce: uint256;
  deadline: uint256;
};

const PERMIT_MESSAGE_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

const SIGNATURE_SHELF_LIFE = 10 * 60; // seconds

function evmCurrentTimePlus(secondsFromNow: number) {
  return (Date.now() / 1000 + secondsFromNow).toFixed(0);
}

function attemptToInferDomain(
  name: string | undefined,
  chainId: number,
  verifyingContract: Address,
  domainSeparator: `0x${string}` | undefined
) {
  let domain: {
    name?: string;
    chainId: number;
    verifyingContract: Address;
    version: string;
  } = { name, chainId, verifyingContract, version: '1' };

  if (domainSeparator) {
    for (const version of ['1', '2', '3']) {
      domain = { chainId, verifyingContract, version, name };
      if (computeDomainSeparator(domain) === domainSeparator) return { domain, success: true };

      domain = { chainId, verifyingContract, version };
      if (computeDomainSeparator(domain) === domainSeparator) return { domain, success: true };
    }
  }

  return { domain, success: false };
}

export function usePermit(
  chainId: number,
  token: Address,
  owner: Address,
  spender: Address,
  amount: string,
  enabled = true
) {
  /*//////////////////////////////////////////////////////////////
                            REACT STATE
  //////////////////////////////////////////////////////////////*/
  const [deadline, setDeadline] = useState<uint256>(evmCurrentTimePlus(SIGNATURE_SHELF_LIFE));

  const erc20 = {
    address: token,
    abi: erc20Abi,
    chainId: chainId,
  };

  const { data, isFetching, isError } = useReadContracts({
    contracts: [
      { ...erc20, functionName: 'DOMAIN_SEPARATOR' },
      { ...erc20, functionName: 'name' },
      { ...erc20, functionName: 'nonces', args: [owner] },
    ] as const,
    allowFailure: false,
    query: { enabled: enabled },
  });

  /*//////////////////////////////////////////////////////////////
                              REFRESHING
  //////////////////////////////////////////////////////////////*/

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

  const domainSeparator = data?.[0];
  const name = data?.[1];
  const nonce = data?.[2];
  const { domain, success: compatible } = attemptToInferDomain(name, erc20.chainId, erc20.address, domainSeparator);

  const permit: Permit | undefined = useMemo(() => {
    if (nonce === undefined) return undefined;
    return {
      owner: owner,
      spender: spender,
      value: amount,
      nonce: nonce.toString(),
      deadline: deadline,
    };
  }, [owner, spender, amount, nonce, deadline]);

  const {
    signTypedData,
    isPending: isAskingUserToSign,
    data: signature,
    reset: resetSignature,
  } = useSignTypedData();

  useEffect(() => {
    resetSignature();
  }, [resetSignature, permit]);

  let state: PermitState;
  let action: (() => void) | undefined;

  if (!enabled) {
    state = PermitState.DISABLED;
    action = undefined;
  } else if (isFetching || permit === undefined) {
    state = PermitState.FETCHING_DATA;
    action = undefined;
  } else if (isAskingUserToSign) {
    state = PermitState.ASKING_USER_TO_SIGN;
    action = undefined;
  } else if (isError || !compatible) {
    state = PermitState.ERROR;
    action = undefined;
  } else if (signature === undefined) {
    state = PermitState.READY_TO_SIGN;
    action = () => signTypedData({ domain, types: PERMIT_MESSAGE_TYPES, primaryType: 'Permit', message: permit });
  } else {
    state = PermitState.DONE;
    action = undefined;
  }

  return {
    state,
    action,
    result: {
      deadline,
      signature: signature ? splitSignature(signature) : undefined,
    },
  };
}
