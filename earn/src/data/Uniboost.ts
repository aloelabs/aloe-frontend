import Big from 'big.js';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { BigNumber, ethers } from 'ethers';
import JSBI from 'jsbi';
import { borrowerAbi } from 'shared/lib/abis/Borrower';
import { borrowerLensAbi } from 'shared/lib/abis/BorrowerLens';
import { borrowerNftAbi } from 'shared/lib/abis/BorrowerNft';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { uniswapV3PoolAbi } from 'shared/lib/abis/UniswapV3Pool';
import { volatilityOracleAbi } from 'shared/lib/abis/VolatilityOracle';
import {
  ALOE_II_BORROWER_NFT_ADDRESS,
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_FACTORY_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
  MULTICALL_ADDRESS,
  ALOE_II_BOOST_MANAGER_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { GN } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { getToken } from 'shared/lib/data/TokenData';
import { Address } from 'wagmi';

import { Assets, Liabilities, MarginAccount } from './MarginAccount';
import { getAmountsForLiquidity, getValueOfLiquidity, tickToPrice, UniswapPosition } from './Uniswap';

export enum BoostCardType {
  UNISWAP_NFT,
  BOOST_NFT,
  BOOST_NFT_GENERALIZED,
}

export class BoostCardInfo {
  constructor(
    public readonly cardType: BoostCardType,
    public readonly nftTokenId: number | string,
    public readonly nftTokenPtr: number,
    public readonly uniswapPool: Address,
    public readonly currentTick: number,
    public readonly token0: Token,
    public readonly token1: Token,
    public readonly lender0: Address,
    public readonly lender1: Address,
    public readonly color0: string,
    public readonly color1: string,
    public readonly position: UniswapPosition,
    public readonly feesEarned: { amount0: GN; amount1: GN },
    public readonly borrower: MarginAccount | null
  ) {}

  static from(boostCardInfo: BoostCardInfo, marginAccount: MarginAccount, position: UniswapPosition): BoostCardInfo {
    return new BoostCardInfo(
      boostCardInfo.cardType,
      boostCardInfo.nftTokenId,
      boostCardInfo.nftTokenPtr,
      boostCardInfo.uniswapPool,
      boostCardInfo.currentTick,
      boostCardInfo.token0,
      boostCardInfo.token1,
      boostCardInfo.lender0,
      boostCardInfo.lender1,
      boostCardInfo.color0,
      boostCardInfo.color1,
      position,
      boostCardInfo.feesEarned,
      marginAccount
    );
  }

  static withColors(boostCardInfo: BoostCardInfo, color0: string, color1: string): BoostCardInfo {
    return new BoostCardInfo(
      boostCardInfo.cardType,
      boostCardInfo.nftTokenId,
      boostCardInfo.nftTokenPtr,
      boostCardInfo.uniswapPool,
      boostCardInfo.currentTick,
      boostCardInfo.token0,
      boostCardInfo.token1,
      boostCardInfo.lender0,
      boostCardInfo.lender1,
      color0,
      color1,
      boostCardInfo.position,
      boostCardInfo.feesEarned,
      boostCardInfo.borrower
    );
  }

  boostFactor() {
    if (this.borrower === null || JSBI.equal(this.position.liquidity, JSBI.BigInt(0))) return null;
    // Compute total value in the Uniswap position
    const uniswapValue = getValueOfLiquidity(this.position, this.currentTick, this.token1.decimals);

    // Compute total debt
    const debt0 = this.borrower.liabilities.amount0 - this.borrower.assets.token0Raw;
    const debt1 = this.borrower.liabilities.amount1 - this.borrower.assets.token1Raw;
    const price = tickToPrice(this.currentTick, this.token0.decimals, this.token1.decimals, true);
    const debtValue = debt0 * price + debt1;

    return uniswapValue / (uniswapValue - debtValue);
  }

  isInRange() {
    return this.position.lower <= this.currentTick && this.currentTick < this.position.upper;
  }

  /**
   * The amount of token0 in the Uniswap Position, not including earned fees
   */
  amount0() {
    return getAmountsForLiquidity(this.position, this.currentTick, this.token0.decimals, this.token1.decimals)[0];
  }

  /**
   * The amount of token1 in the Uniswap Position, not including earned fees
   */
  amount1() {
    return getAmountsForLiquidity(this.position, this.currentTick, this.token0.decimals, this.token1.decimals)[1];
  }

  /**
   * The amount of token0 in the Uniswap Position as a percentage, not including earned fees
   */
  amount0Percent() {
    if (JSBI.equal(this.position.liquidity, JSBI.BigInt(0))) return 0;
    return 1 - this.amount1Percent();
  }

  /**
   * The amount of token1 in the Uniswap Position as a percentage, not including earned fees
   */
  amount1Percent() {
    if (JSBI.equal(this.position.liquidity, JSBI.BigInt(0))) return 0;
    const amount1 = this.amount1();
    const totalValueIn1 = getValueOfLiquidity(this.position, this.currentTick, this.token1.decimals);
    return amount1 / totalValueIn1;
  }
}

export async function fetchBoostBorrowersList(
  chainId: number,
  provider: ethers.providers.BaseProvider,
  userAddress: string
) {
  const borrowerNftContract = new ethers.Contract(ALOE_II_BORROWER_NFT_ADDRESS[chainId], borrowerNftAbi, provider);

  const transfersFrom = await borrowerNftContract.queryFilter(
    borrowerNftContract.filters.Transfer(userAddress, null, null),
    0,
    'latest'
  );
  const transfersTo = await borrowerNftContract.queryFilter(
    borrowerNftContract.filters.Transfer(null, userAddress, null),
    0,
    'latest'
  );
  const transfers = transfersFrom.concat(transfersTo);
  transfers.sort((a, b) => {
    if (a.blockNumber === b.blockNumber) {
      if (a.transactionIndex === b.transactionIndex) {
        return a.logIndex - b.logIndex;
      }
      return a.transactionIndex - b.transactionIndex;
    }
    return a.blockNumber - b.blockNumber;
  });

  let orderedTokenIds: BigNumber[] = [];
  for (const transfer of transfers) {
    if (transfer.args?.['to'] === userAddress) {
      orderedTokenIds.push(transfer.args['tokenId']);
      continue;
    }

    orderedTokenIds = orderedTokenIds.filter((tokenId) => !tokenId.eq(transfer.args?.['tokenId']));
  }
  const orderedTokenIdStrs = orderedTokenIds.map((id) => id.toHexString());

  const modifys = await borrowerNftContract.queryFilter(
    borrowerNftContract.filters.Modify(userAddress, null, null),
    0,
    'latest'
  );

  const borrowerManagersMap: Map<Address, Set<Address>> = new Map();
  modifys.forEach((modify) => {
    const borrower = modify.args!['borrower'] as Address;
    const manager = modify.args!['manager'] as Address;
    if (borrowerManagersMap.has(borrower)) {
      borrowerManagersMap.get(borrower)?.add(manager);
    } else {
      borrowerManagersMap.set(borrower, new Set<Address>([manager]));
    }
  });

  const borrowers = Array.from(borrowerManagersMap.entries())
    .filter(([borrower, managerSet]) => managerSet.size === 1 && managerSet.has(ALOE_II_BOOST_MANAGER_ADDRESS[chainId]))
    .map(([borrower, managerSet]) => borrower);

  const tokenIds = borrowers.map((borrower) => orderedTokenIdStrs.find((x) => x.startsWith(borrower.toLowerCase()))!);
  const indices = borrowers.map((borrower) =>
    orderedTokenIdStrs.findIndex((x) => x.startsWith(borrower.toLowerCase()))
  );

  return { borrowers, tokenIds, indices };
}

export async function fetchBoostBorrower(
  chainId: number,
  provider: ethers.providers.BaseProvider,
  borrowerAddress: Address
) {
  const mainContext: ContractCallContext[] = [
    {
      reference: 'borrower',
      contractAddress: borrowerAddress,
      abi: borrowerAbi as any,
      calls: [
        { reference: 'token0', methodName: 'TOKEN0', methodParameters: [] },
        { reference: 'token1', methodName: 'TOKEN1', methodParameters: [] },
        { reference: 'lender0', methodName: 'LENDER0', methodParameters: [] },
        { reference: 'lender1', methodName: 'LENDER1', methodParameters: [] },
        { reference: 'uniswapPool', methodName: 'UNISWAP_POOL', methodParameters: [] },
        { reference: 'position', methodName: 'getUniswapPositions', methodParameters: [] },
      ],
    },
    {
      reference: 'lens',
      contractAddress: ALOE_II_BORROWER_LENS_ADDRESS[chainId],
      abi: borrowerLensAbi as any,
      calls: [
        { reference: 'getAssets', methodName: 'getAssets', methodParameters: [borrowerAddress] },
        { reference: 'getLiabilities', methodName: 'getLiabilities', methodParameters: [borrowerAddress, true] },
        { reference: 'getHealth', methodName: 'getHealth', methodParameters: [borrowerAddress, true] },
        { reference: 'getUniswapFees', methodName: 'getUniswapFees', methodParameters: [borrowerAddress] },
      ],
    },
  ];

  // Execute multicall fetch
  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chainId],
  });
  const mainResults = (await multicall.call(mainContext)).results;

  // ---
  // Parse results from borrower
  // ---
  const borrowerResults = mainResults['borrower'].callsReturnContext;
  if (borrowerResults.find((v) => !v.success || !v.decoded)) {
    throw new Error(`Error while fetching Borrower information in multicall (${borrowerAddress})`);
  }
  const [token0Addr, token1Addr, lender0, lender1, uniswapPool] = borrowerResults
    .slice(0, -1)
    .map((v) => v.returnValues[0] as Address);
  const token0 = getToken(chainId, token0Addr)!;
  const token1 = getToken(chainId, token1Addr)!;
  const [tickLower, tickUpper] = borrowerResults.at(-1)!.returnValues;

  // ---
  // Parse results from lens
  // ---
  const lensResults = mainResults['lens'].callsReturnContext;
  if (lensResults.find((v) => !v.success || !v.decoded)) {
    throw new Error(`Error while fetching Borrower information in multicall (${borrowerAddress})`);
  }

  const assets: Assets = {
    token0Raw: GN.hexToGn(lensResults[0].returnValues[0], token0.decimals).toNumber(),
    token1Raw: GN.hexToGn(lensResults[0].returnValues[1], token1.decimals).toNumber(),
    uni0: GN.hexToGn(lensResults[0].returnValues[4], token0.decimals).toNumber(),
    uni1: GN.hexToGn(lensResults[0].returnValues[5], token1.decimals).toNumber(),
  };
  const liabilities: Liabilities = {
    amount0: GN.hexToGn(lensResults[1].returnValues[0], token0.decimals).toNumber(),
    amount1: GN.hexToGn(lensResults[1].returnValues[1], token1.decimals).toNumber(),
  };
  const health = GN.min(
    GN.hexToGn(lensResults[2].returnValues[0], 18),
    GN.hexToGn(lensResults[2].returnValues[1], 18)
  ).toNumber();
  const uniswapKey = lensResults[3].returnValues[0][0];
  const uniswapFees = {
    amount0: GN.hexToGn(lensResults[3].returnValues[1][0], token0.decimals),
    amount1: GN.hexToGn(lensResults[3].returnValues[1][1], token1.decimals),
  };

  // ---
  // Now we do another multicall to get:
  // - TWAP and IV from the VolatilityOracle
  // - numeric fee Uniswap fee tier
  // ---
  const extraContext: ContractCallContext[] = [
    {
      reference: 'oracle',
      contractAddress: ALOE_II_ORACLE_ADDRESS[chainId],
      abi: volatilityOracleAbi as any,
      calls: [{ reference: 'consult', methodName: 'consult', methodParameters: [uniswapPool, 1 << 32] }],
    },
    {
      reference: 'uniswap',
      contractAddress: uniswapPool,
      abi: uniswapV3PoolAbi as any,
      calls: [
        { reference: 'fee', methodName: 'fee', methodParameters: [] },
        { reference: 'positions', methodName: 'positions', methodParameters: [uniswapKey] },
      ],
    },
    {
      reference: 'nSgima',
      contractAddress: ALOE_II_FACTORY_ADDRESS[chainId],
      abi: factoryAbi as any,
      calls: [
        {
          reference: 'getParameters',
          methodName: 'getParameters',
          methodParameters: [uniswapPool],
        },
      ],
    },
  ];

  const extraResults = (await multicall.call(extraContext)).results;

  const consultResult = extraResults['oracle'].callsReturnContext[0].returnValues;
  const sqrtPriceX96 = new Big(ethers.BigNumber.from(consultResult[1].hex).toString());
  const iv = GN.hexToGn(consultResult[2].hex, 12).toNumber();
  const feeTier = NumericFeeTierToEnum(extraResults['uniswap'].callsReturnContext[0].returnValues[0]);
  const liquidity = ethers.BigNumber.from(extraResults['uniswap'].callsReturnContext[1].returnValues[0].hex);
  const nSigma = extraResults['nSgima'].callsReturnContext[0].returnValues[1] / 10;

  const borrower: MarginAccount = {
    address: borrowerAddress,
    uniswapPool,
    feeTier,
    token0,
    token1,
    assets,
    liabilities,
    sqrtPriceX96,
    health,
    lender0,
    lender1,
    iv,
    nSigma,
  };

  const uniswapPosition: UniswapPosition = {
    lower: tickLower,
    upper: tickUpper,
    liquidity: JSBI.BigInt(liquidity.toString()),
  };

  return {
    borrower,
    uniswapPosition,
    uniswapFees,
  };
}
