export const volatilityOracleAbi = [
  {
    type: 'function',
    name: 'cachedMetadata',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IUniswapV3Pool',
      },
    ],
    outputs: [
      { name: 'gamma0', type: 'uint24', internalType: 'uint24' },
      { name: 'gamma1', type: 'uint24', internalType: 'uint24' },
      { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'consult',
    inputs: [
      {
        name: 'pool',
        type: 'address',
        internalType: 'contract IUniswapV3Pool',
      },
      { name: 'seed', type: 'uint40', internalType: 'uint40' },
    ],
    outputs: [
      { name: '', type: 'uint56', internalType: 'uint56' },
      { name: '', type: 'uint160', internalType: 'uint160' },
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'feeGrowthGlobals',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IUniswapV3Pool',
      },
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [
      {
        name: 'feeGrowthGlobal0X128',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'feeGrowthGlobal1X128',
        type: 'uint256',
        internalType: 'uint256',
      },
      { name: 'timestamp', type: 'uint32', internalType: 'uint32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lastWrites',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IUniswapV3Pool',
      },
    ],
    outputs: [
      { name: 'index', type: 'uint8', internalType: 'uint8' },
      { name: 'time', type: 'uint40', internalType: 'uint40' },
      { name: 'oldIV', type: 'uint104', internalType: 'uint104' },
      { name: 'newIV', type: 'uint104', internalType: 'uint104' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'prepare',
    inputs: [
      {
        name: 'pool',
        type: 'address',
        internalType: 'contract IUniswapV3Pool',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'update',
    inputs: [
      {
        name: 'pool',
        type: 'address',
        internalType: 'contract IUniswapV3Pool',
      },
      { name: 'seed', type: 'uint40', internalType: 'uint40' },
    ],
    outputs: [
      { name: '', type: 'uint56', internalType: 'uint56' },
      { name: '', type: 'uint160', internalType: 'uint160' },
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Update',
    inputs: [
      {
        name: 'pool',
        type: 'address',
        indexed: true,
        internalType: 'contract IUniswapV3Pool',
      },
      {
        name: 'sqrtMeanPriceX96',
        type: 'uint160',
        indexed: false,
        internalType: 'uint160',
      },
      {
        name: 'iv',
        type: 'uint104',
        indexed: false,
        internalType: 'uint104',
      },
    ],
    anonymous: false,
  },
] as const;
