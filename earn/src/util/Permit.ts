import { BigNumberish, Contract, ethers } from 'ethers';
import { arrayify, defaultAbiCoder, keccak256, solidityKeccak256, toUtf8Bytes } from 'ethers/lib/utils';

export type PermitData = {
  approve: {
    owner: string;
    spender: string;
    value: BigNumberish;
  };
  deadline: BigNumberish;
  digest: string;
};

export type Signature = {
  v: string;
  r: string;
  s: string;
};

export async function sign(digest: string, signer: ethers.Signer): Promise<Signature> {
  const digestUint8Array = arrayify(digest);
  const signature = await signer.signMessage(digestUint8Array);
  return {
    v: '0x' + signature.slice(130, 132),
    r: signature.slice(0, 66),
    s: '0x' + signature.slice(66, 130),
  };
}

export const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
);

// Returns the EIP712 hash which should be signed by the user
// in order to make a call to `permit`
export async function getPermitDigest(
  erc20Contract: Contract,
  approve: {
    owner: string;
    spender: string;
    value: BigNumberish;
  },
  deadline: BigNumberish
) {
  try {
    const DOMAIN_SEPARATOR = await getDomainSeparator(erc20Contract);
    const nonce = await getNonce(erc20Contract, approve.owner);

    const digest = solidityKeccak256(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        keccak256(
          defaultAbiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
          )
        ),
      ]
    );
    return { approve, deadline, digest };
  } catch (e) {
    // eslint-disable-next-line max-len
    console.error(
      'Unable to fetch EIP712 domain separator, implying that this ERC20 token does not conform to EIP2612. ',
      e
    );
    return undefined;
  }
}

// Gets the EIP712 domain separator
export async function getDomainSeparator(erc20Contract: Contract) {
  return erc20Contract.DOMAIN_SEPARATOR();
}

export async function getNonce(erc20Contract: Contract, owner: string) {
  return erc20Contract.nonces(owner);
}
