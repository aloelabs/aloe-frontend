export const routerAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'permit2',
        type: 'address',
        internalType: 'contract IPermit2',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'PERMIT2',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract IPermit2' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'depositWithPermit2',
    inputs: [
      {
        name: 'lender',
        type: 'address',
        internalType: 'contract Lender',
      },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'transmittance', type: 'uint16', internalType: 'uint16' },
      { name: 'nonce', type: 'uint256', internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'depositWithPermit2',
    inputs: [
      {
        name: 'lender',
        type: 'address',
        internalType: 'contract Lender',
      },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'transmittance', type: 'uint16', internalType: 'uint16' },
      { name: 'nonce', type: 'uint256', internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
      { name: 'courierId', type: 'uint32', internalType: 'uint32' },
      { name: 'v', type: 'uint8', internalType: 'uint8' },
      { name: 'r', type: 'bytes32', internalType: 'bytes32' },
      { name: 's', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'repayWithPermit2',
    inputs: [
      {
        name: 'lender',
        type: 'address',
        internalType: 'contract Lender',
      },
      { name: 'max', type: 'bool', internalType: 'bool' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'beneficiary', type: 'address', internalType: 'address' },
      { name: 'nonce', type: 'uint256', internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: 'units', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;
