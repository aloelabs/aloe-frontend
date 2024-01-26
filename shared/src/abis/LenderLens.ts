export const lenderLensAbi = [
  {
    type: 'function',
    name: 'isMaxRedeemDynamic',
    inputs: [
      {
        name: 'lender',
        type: 'address',
        internalType: 'contract Lender',
      },
      { name: 'owner', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'readBasics',
    inputs: [
      {
        name: 'lender',
        type: 'address',
        internalType: 'contract Lender',
      },
    ],
    outputs: [
      {
        name: 'asset',
        type: 'address',
        internalType: 'contract ERC20',
      },
      {
        name: 'interestRate',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: 'utilization', type: 'uint256', internalType: 'uint256' },
      { name: 'inventory', type: 'uint256', internalType: 'uint256' },
      {
        name: 'totalBorrows',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: 'totalSupply', type: 'uint256', internalType: 'uint256' },
      { name: 'reserveFactor', type: 'uint8', internalType: 'uint8' },
      { name: 'rewardsRate', type: 'uint64', internalType: 'uint64' },
    ],
    stateMutability: 'view',
  },
] as const;
