export const lenderLensAbi = [
  {
    inputs: [
      {
        internalType: 'contract Lender',
        name: 'lender',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
    ],
    name: 'isMaxRedeemDynamic',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract Lender',
        name: 'lender',
        type: 'address',
      },
    ],
    name: 'readBasics',
    outputs: [
      {
        internalType: 'contract ERC20',
        name: 'asset',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'interestRate',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'utilization',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'inventory',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'totalBorrows',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'totalSupply',
        type: 'uint256',
      },
      {
        internalType: 'uint8',
        name: 'reserveFactor',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
