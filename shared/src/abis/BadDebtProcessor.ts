export const badDebtProcessorAbi = [
  { type: 'receive', stateMutability: 'payable' },
  {
    type: 'function',
    name: 'callback',
    inputs: [
      { name: '', type: 'bytes', internalType: 'bytes' },
      { name: '', type: 'address', internalType: 'address' },
      {
        name: 'amounts',
        type: 'tuple',
        internalType: 'struct AuctionAmounts',
        components: [
          { name: 'out0', type: 'uint256', internalType: 'uint256' },
          { name: 'out1', type: 'uint256', internalType: 'uint256' },
          { name: 'repay0', type: 'uint256', internalType: 'uint256' },
          { name: 'repay1', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'process',
    inputs: [
      {
        name: 'lender',
        type: 'address',
        internalType: 'contract Lender',
      },
      {
        name: 'borrower',
        type: 'address',
        internalType: 'contract Borrower',
      },
      {
        name: 'flashPool',
        type: 'address',
        internalType: 'contract IUniswapV3Pool',
      },
      { name: 'slippage', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'processWithPermit',
    inputs: [
      {
        name: 'lender',
        type: 'address',
        internalType: 'contract Lender',
      },
      {
        name: 'borrower',
        type: 'address',
        internalType: 'contract Borrower',
      },
      {
        name: 'flashPool',
        type: 'address',
        internalType: 'contract IUniswapV3Pool',
      },
      { name: 'slippage', type: 'uint256', internalType: 'uint256' },
      { name: 'allowance', type: 'uint256', internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
      { name: 'v', type: 'uint8', internalType: 'uint8' },
      { name: 'r', type: 'bytes32', internalType: 'bytes32' },
      { name: 's', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'uniswapV3FlashCallback',
    inputs: [
      { name: 'fee0', type: 'uint256', internalType: 'uint256' },
      { name: 'fee1', type: 'uint256', internalType: 'uint256' },
      { name: 'data', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'uniswapV3SwapCallback',
    inputs: [
      { name: 'amount0Delta', type: 'int256', internalType: 'int256' },
      { name: 'amount1Delta', type: 'int256', internalType: 'int256' },
      { name: '', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;
