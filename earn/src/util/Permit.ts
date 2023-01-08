import { BigNumberish, Contract } from 'ethers';
import { defaultAbiCoder, keccak256, splitSignature, toUtf8Bytes } from 'ethers/lib/utils';

type Domain = {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: string;
  salt?: string;
};

// Gets the EIP712 domain separator
function getDomainSeparator(erc20Contract: Contract) {
  return erc20Contract.DOMAIN_SEPARATOR();
}

function getNonce(erc20Contract: Contract, owner: string) {
  return erc20Contract.nonces(owner);
}

function computeDomainSeparator(domain: Domain) {
  let params: string[] = [];
  let types: ('bytes32' | 'uint256' | 'address')[] = ['bytes32'];
  let args: any[] = [];

  if (domain.name) {
    params.push('string name');
    types.push('bytes32');
    args.push(keccak256(toUtf8Bytes(domain.name)));
  }
  if (domain.version) {
    params.push('string version');
    types.push('bytes32');
    args.push(keccak256(toUtf8Bytes(domain.version)));
  }
  if (domain.chainId) {
    params.push('uint256 chainId');
    types.push('uint256');
    args.push(domain.chainId.toFixed(0));
  }
  if (domain.verifyingContract) {
    params.push('address verifyingContract');
    types.push('address');
    args.push(domain.verifyingContract);
  }
  if (domain.salt) {
    params.push('bytes32 salt');
    types.push('bytes32');
    args.push(domain.salt);
  }

  return keccak256(
    defaultAbiCoder.encode(types, [keccak256(toUtf8Bytes(`EIP712Domain(${params.join(',')})`)), ...args])
  );
}

export async function doesSupportPermit(erc20Contract: Contract) {
  try {
    await getDomainSeparator(erc20Contract);
    return true;
  } catch {
    return false;
  }
}

export async function getErc2612Signature(
  signer: any,
  chainId: number,
  erc20Contract: Contract,
  approve: {
    owner: string;
    spender: string;
    value: BigNumberish;
  },
  deadline: BigNumberish
) {
  const version = '1';
  const [nonce, name, expectedDomainSeparator] = await Promise.all([
    getNonce(erc20Contract, approve.owner),
    erc20Contract.name(),
    getDomainSeparator(erc20Contract),
  ]);

  const domain: Domain = {
    name,
    version,
    chainId,
    verifyingContract: erc20Contract.address,
  };
  if (computeDomainSeparator(domain) !== expectedDomainSeparator) {
    delete domain.name;
    if (computeDomainSeparator(domain) !== expectedDomainSeparator) {
      console.error('Could not infer structure of domain separator');
    }
  }

  return splitSignature(
    await signer._signTypedData(
      domain,
      {
        Permit: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
      },
      {
        owner: approve.owner,
        spender: approve.spender,
        value: approve.value,
        nonce: nonce,
        deadline: deadline,
      }
    )
  );
}
