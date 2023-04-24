import { BigNumberish, Contract } from 'ethers';
import { defaultAbiCoder, keccak256, splitSignature, toUtf8Bytes } from 'ethers/lib/utils';

export type EIP2612Domain = {
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

export function computeDomainSeparator(domain: EIP2612Domain) {
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

export async function attemptToInferPermitDomain(
  erc20Contract: Contract,
  chainId: number
): Promise<EIP2612Domain | null> {
  try {
    const [name, expectedDomainSeparator] = await Promise.all([
      erc20Contract.name(),
      getDomainSeparator(erc20Contract),
    ]);

    let domain: EIP2612Domain = {
      name,
      version: '1',
      chainId,
      verifyingContract: erc20Contract.address,
    };

    let attempt = 1;
    while (computeDomainSeparator(domain) !== expectedDomainSeparator) {
      switch (attempt) {
        case 1:
          // Increase to version 2
          domain.version = '2';
          break;
        case 2:
          // Try removing name, still at version 2
          delete domain.name;
          break;
        case 3:
          // Back to version 1, still without name
          domain.version = '1';
          break;
        default:
          console.error('Could not infer structure of domain separator');
          return null;
      }
      attempt += 1;
    }

    return domain;
  } catch {
    return null;
  }
}

export async function getErc2612Signature(
  signer: any,
  erc20Contract: Contract,
  domain: EIP2612Domain,
  approve: {
    owner: string;
    spender: string;
    value: BigNumberish;
  },
  deadline: BigNumberish
) {
  const nonce = await getNonce(erc20Contract, approve.owner);

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
