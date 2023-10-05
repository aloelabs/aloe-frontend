export const factoryAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'governor',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'reserve',
        type: 'address',
      },
      {
        internalType: 'contract VolatilityOracle',
        name: 'oracle',
        type: 'address',
      },
      {
        internalType: 'contract BorrowerDeployer',
        name: 'borrowerDeployer',
        type: 'address',
      },
      {
        internalType: 'contract IRateModel',
        name: 'defaultRateModel',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'contract IUniswapV3Pool',
        name: 'pool',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'contract Borrower',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'CreateBorrower',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'contract IUniswapV3Pool',
        name: 'pool',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'contract Lender',
        name: 'lender0',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'contract Lender',
        name: 'lender1',
        type: 'address',
      },
    ],
    name: 'CreateMarket',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint32',
        name: 'id',
        type: 'uint32',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'wallet',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint16',
        name: 'cut',
        type: 'uint16',
      },
    ],
    name: 'EnrollCourier',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'contract IUniswapV3Pool',
        name: 'pool',
        type: 'address',
      },
      {
        components: [
          {
            internalType: 'uint208',
            name: 'ante',
            type: 'uint208',
          },
          {
            internalType: 'uint8',
            name: 'nSigma',
            type: 'uint8',
          },
          {
            internalType: 'uint8',
            name: 'manipulationThresholdDivisor',
            type: 'uint8',
          },
          {
            internalType: 'uint8',
            name: 'reserveFactor0',
            type: 'uint8',
          },
          {
            internalType: 'uint8',
            name: 'reserveFactor1',
            type: 'uint8',
          },
          {
            internalType: 'contract IRateModel',
            name: 'rateModel0',
            type: 'address',
          },
          {
            internalType: 'contract IRateModel',
            name: 'rateModel1',
            type: 'address',
          },
        ],
        indexed: false,
        internalType: 'struct Factory.MarketConfig',
        name: 'config',
        type: 'tuple',
      },
    ],
    name: 'SetMarketConfig',
    type: 'event',
  },
  {
    inputs: [],
    name: 'DEFAULT_RATE_MODEL',
    outputs: [
      {
        internalType: 'contract IRateModel',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'GOVERNOR',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'LENDER_IMPLEMENTATION',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'ORACLE',
    outputs: [
      {
        internalType: 'contract VolatilityOracle',
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
        internalType: 'contract Lender[]',
        name: 'lenders',
        type: 'address[]',
      },
      {
        internalType: 'address',
        name: 'beneficiary',
        type: 'address',
      },
    ],
    name: 'claimRewards',
    outputs: [
      {
        internalType: 'uint256',
        name: 'earned',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: '',
        type: 'uint32',
      },
    ],
    name: 'couriers',
    outputs: [
      {
        internalType: 'address',
        name: 'wallet',
        type: 'address',
      },
      {
        internalType: 'uint16',
        name: 'cut',
        type: 'uint16',
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
    ],
    name: 'createBorrower',
    outputs: [
      {
        internalType: 'contract Borrower',
        name: 'borrower',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract IUniswapV3Pool',
        name: 'pool',
        type: 'address',
      },
    ],
    name: 'createMarket',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint32',
        name: 'id',
        type: 'uint32',
      },
      {
        internalType: 'uint16',
        name: 'cut',
        type: 'uint16',
      },
    ],
    name: 'enrollCourier',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract IUniswapV3Pool',
        name: '',
        type: 'address',
      },
    ],
    name: 'getMarket',
    outputs: [
      {
        internalType: 'contract Lender',
        name: 'lender0',
        type: 'address',
      },
      {
        internalType: 'contract Lender',
        name: 'lender1',
        type: 'address',
      },
      {
        internalType: 'contract Borrower',
        name: 'borrowerImplementation',
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
        name: '',
        type: 'address',
      },
    ],
    name: 'getParameters',
    outputs: [
      {
        internalType: 'uint208',
        name: 'ante',
        type: 'uint208',
      },
      {
        internalType: 'uint8',
        name: 'nSigma',
        type: 'uint8',
      },
      {
        internalType: 'uint8',
        name: 'manipulationThresholdDivisor',
        type: 'uint8',
      },
      {
        internalType: 'uint32',
        name: 'pausedUntilTime',
        type: 'uint32',
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
        components: [
          {
            internalType: 'uint208',
            name: 'ante',
            type: 'uint208',
          },
          {
            internalType: 'uint8',
            name: 'nSigma',
            type: 'uint8',
          },
          {
            internalType: 'uint8',
            name: 'manipulationThresholdDivisor',
            type: 'uint8',
          },
          {
            internalType: 'uint8',
            name: 'reserveFactor0',
            type: 'uint8',
          },
          {
            internalType: 'uint8',
            name: 'reserveFactor1',
            type: 'uint8',
          },
          {
            internalType: 'contract IRateModel',
            name: 'rateModel0',
            type: 'address',
          },
          {
            internalType: 'contract IRateModel',
            name: 'rateModel1',
            type: 'address',
          },
        ],
        internalType: 'struct Factory.MarketConfig',
        name: 'config',
        type: 'tuple',
      },
    ],
    name: 'governMarketConfig',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract Lender',
        name: 'lender',
        type: 'address',
      },
      {
        internalType: 'uint56',
        name: 'rate',
        type: 'uint56',
      },
    ],
    name: 'governRewardsRate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'contract ERC20',
        name: 'rewardsToken_',
        type: 'address',
      },
    ],
    name: 'governRewardsToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'isBorrower',
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
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'isCourier',
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
        internalType: 'contract IUniswapV3Pool',
        name: 'pool',
        type: 'address',
      },
      {
        internalType: 'uint40',
        name: 'oracleSeed',
        type: 'uint40',
      },
    ],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'peer',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'rewardsToken',
    outputs: [
      {
        internalType: 'contract ERC20',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
