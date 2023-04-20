import { defaultAbiCoder, keccak256, toUtf8Bytes } from 'ethers/lib/utils';

export type EIP2612Domain = {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: string;
  salt?: string;
};

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
