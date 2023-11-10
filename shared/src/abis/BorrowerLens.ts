export const borrowerLensAbi = [
  {
    inputs: [
      {
        internalType: 'contract Borrower',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'getAssets',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'fixed0',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'fixed1',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'fluid1A',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'fluid1B',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'fluid0C',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'fluid1C',
            type: 'uint256',
          },
        ],
        internalType: 'struct Assets',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract Borrower',
        name: 'account',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: 'previewInterest',
        type: 'bool',
      },
    ],
    name: 'getHealth',
    outputs: [
      {
        internalType: 'uint256',
        name: 'healthA',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'healthB',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract Borrower',
        name: 'account',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: 'previewInterest',
        type: 'bool',
      },
    ],
    name: 'getLiabilities',
    outputs: [
      {
        internalType: 'uint256',
        name: 'amount0',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'amount1',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract Borrower',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'getUniswapFees',
    outputs: [
      {
        internalType: 'bytes32[]',
        name: 'keys',
        type: 'bytes32[]',
      },
      {
        internalType: 'uint256[]',
        name: 'fees',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract Borrower',
        name: 'borrower',
        type: 'address',
      },
    ],
    name: 'isInUse',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
      {
        internalType: 'contract IUniswapV3Pool',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract IUniswapV3Pool',
        name: 'pool',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        internalType: 'bytes12',
        name: 'salt',
        type: 'bytes12',
      },
      {
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        internalType: 'contract Factory',
        name: 'factory',
        type: 'address',
      },
    ],
    name: 'predictBorrowerAddress',
    outputs: [
      {
        internalType: 'address',
        name: 'borrower',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];
