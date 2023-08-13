import Big from 'big.js';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import {
  ALOE_II_BOOST_NFT_ADDRESS,
  ALOE_II_BORROWER_LENS_ADDRESS,
  ALOE_II_ORACLE_ADDRESS,
  MULTICALL_ADDRESS,
} from 'shared/lib/data/constants/ChainSpecific';
import { NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { GN } from 'shared/lib/data/GoodNumber';
import { Token } from 'shared/lib/data/Token';
import { getToken } from 'shared/lib/data/TokenData';
import { Address } from 'wagmi';

import BoostNftAbi from '../assets/abis/BoostNFT.json';
import BorrowerAbi from '../assets/abis/MarginAccount.json';
import BorrowerLensAbi from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolAbi from '../assets/abis/UniswapV3Pool.json';
import VolatilityOracleAbi from '../assets/abis/VolatilityOracle.json';
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
    public readonly uniswapPool: Address,
    public readonly currentTick: number,
    public readonly token0: Token,
    public readonly token1: Token,
    public readonly color0: string,
    public readonly color1: string,
    public readonly position: UniswapPosition,
    public readonly feesEarned: { amount0: GN; amount1: GN },
    public readonly borrower: MarginAccount | null
  ) {}

  boostFactor() {
    if (this.borrower === null) return null;
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
    return 1 - this.amount1Percent();
  }

  /**
   * The amount of token1 in the Uniswap Position as a percentage, not including earned fees
   */
  amount1Percent() {
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
  const boostNftContract = new ethers.Contract(ALOE_II_BOOST_NFT_ADDRESS[chainId], BoostNftAbi, provider);

  // Figure out how many Boost NFTs the user has
  const numBoostNfts: number = (await boostNftContract.balanceOf(userAddress)).toNumber();
  // We can compute the `id` of each NFT offline using this hashing thingy
  const tokenIds: string[] = [];
  for (let i = 0; i < numBoostNfts; i += 1) {
    tokenIds.push(ethers.utils.solidityKeccak256(['address', 'uint256'], [userAddress, i]));
  }

  // For each NFT `id`, we need to get some metadata. This is called "attributes" on the contract, and it
  // returns a tuple: (borrower, isGeneralized)
  // The borrower is the `Borrower` corresponding to the given NFT `id`, and `isGeneralized` indicates whether
  // it is fully controlled by the Boost contract, or if the user has taken over with manual control.
  const attributesCallContext: ContractCallContext[] = [
    {
      reference: 'attributes',
      contractAddress: boostNftContract.address,
      abi: BoostNftAbi,
      calls: tokenIds.map((id) => ({
        reference: `attributesOf(${id})`,
        methodName: 'attributesOf',
        methodParameters: [id],
      })),
    },
  ];

  // Parse multicall results. Note that I'm filtering out generalized borrowers, but we may want to find
  // a way to show those in the future
  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
    multicallCustomContractAddress: MULTICALL_ADDRESS[chainId],
  });
  const attributes = (await multicall.call(attributesCallContext)).results['attributes']?.callsReturnContext ?? [];
  const borrowers = attributes.filter((v) => !v.success || !v.returnValues.at(1)).map((v) => v.returnValues[0]);

  return { borrowers: borrowers as Address[], tokenIds };
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
      abi: BorrowerAbi,
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
      abi: BorrowerLensAbi,
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
  const token0 = getToken(chainId, token0Addr);
  const token1 = getToken(chainId, token1Addr);
  const [tickLower, tickUpper] = borrowerResults.at(-1)!.returnValues;

  // ---
  // Parse results from lens
  // ---
  const lensResults = mainResults['lens'].callsReturnContext;
  if (lensResults.find((v) => !v.success || !v.decoded)) {
    throw new Error(`Error while fetching Borrower information in multicall (${borrowerAddress})`);
  }

  const hexToGn = (hex: string, decimals: number) => {
    return GN.fromBigNumber(ethers.BigNumber.from(hex), decimals, 10);
  };

  const assets: Assets = {
    token0Raw: hexToGn(lensResults[0].returnValues[0], token0.decimals).toNumber(),
    token1Raw: hexToGn(lensResults[0].returnValues[1], token1.decimals).toNumber(),
    uni0: hexToGn(lensResults[0].returnValues[4], token0.decimals).toNumber(),
    uni1: hexToGn(lensResults[0].returnValues[5], token1.decimals).toNumber(),
  };
  const liabilities: Liabilities = {
    amount0: hexToGn(lensResults[1].returnValues[0], token0.decimals).toNumber(),
    amount1: hexToGn(lensResults[1].returnValues[1], token1.decimals).toNumber(),
  };
  const health = GN.min(
    hexToGn(lensResults[2].returnValues[0], 18),
    hexToGn(lensResults[2].returnValues[1], 18)
  ).toNumber();
  const uniswapKey = lensResults[3].returnValues[0][0];
  const uniswapFees = {
    amount0: hexToGn(lensResults[3].returnValues[1][0], token0.decimals),
    amount1: hexToGn(lensResults[3].returnValues[1][1], token1.decimals),
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
      abi: VolatilityOracleAbi,
      calls: [{ reference: 'consult', methodName: 'consult', methodParameters: [uniswapPool] }],
    },
    {
      reference: 'uniswap',
      contractAddress: uniswapPool,
      abi: UniswapV3PoolAbi,
      calls: [
        { reference: 'fee', methodName: 'fee', methodParameters: [] },
        { reference: 'positions', methodName: 'positions', methodParameters: [uniswapKey] },
      ],
    },
  ];

  const extraResults = (await multicall.call(extraContext)).results;

  const consultResult = extraResults['oracle'].callsReturnContext[0].returnValues;
  const sqrtPriceX96 = new Big(ethers.BigNumber.from(consultResult[0].hex).toString());
  const iv = hexToGn(consultResult[1].hex, 18).toNumber();
  const feeTier = NumericFeeTierToEnum(extraResults['uniswap'].callsReturnContext[0].returnValues[0]);
  const liquidity = ethers.BigNumber.from(extraResults['uniswap'].callsReturnContext[1].returnValues[0].hex);

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
