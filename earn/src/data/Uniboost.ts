/**
 * 1. balance = boostNft.balanceOf(userAddress)
 * 2. for i in range(balance): tokenIds.append(keccak(abi.encodePacked(userAddress, i)))
 * 3. for tokenId in tokenIds: borrowers.append(boostNft.attributesOf(tokenId))
 */

import { arbitrum, optimism } from '@wagmi/chains';
import Big from 'big.js';
import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { NumericFeeTierToEnum } from 'shared/lib/data/FeeTier';
import { GN } from 'shared/lib/data/GoodNumber';
import { getToken } from 'shared/lib/data/TokenData';
import { Address, Chain } from 'wagmi';

import BoostNftAbi from '../assets/abis/BoostNFT.json';
import BorrowerAbi from '../assets/abis/MarginAccount.json';
import BorrowerLensAbi from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolAbi from '../assets/abis/UniswapV3Pool.json';
import VolatilityOracleAbi from '../assets/abis/VolatilityOracle.json';
import { ALOE_II_BORROWER_LENS_ADDRESS, ALOE_II_ORACLE_ADDRESS } from './constants/Addresses';
import { Assets, Liabilities, MarginAccount } from './MarginAccount';
import { UniswapPosition } from './Uniswap';

const BOOST_NFT_ADDRESSES: { [chainId: number]: Address } = {
  [optimism.id]: '0xA58eEcBd367334E742554ce6A2CC8b6863487ebB',
  [arbitrum.id]: '0xA58eEcBd367334E742554ce6A2CC8b6863487ebB',
  8453: '0xecED17C61971A32E28bc55537e8103ce3002d0dA',
};

export async function fetchBoostBorrowersList(
  chain: Chain,
  provider: ethers.providers.BaseProvider,
  userAddress: string
) {
  const boostNftContract = new ethers.Contract(BOOST_NFT_ADDRESSES[chain.id], BoostNftAbi, provider);

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
  const attributesCallContext: ContractCallContext[] = tokenIds.map((id) => ({
    reference: 'attributes',
    contractAddress: boostNftContract.address,
    abi: BoostNftAbi,
    calls: [
      {
        reference: `attributesOf(${id})`,
        methodName: 'attributesOf',
        methodParameters: [id],
      },
    ],
  }));

  // Parse multicall results. Note that I'm filtering out generalized borrowers, but we may want to find
  // a way to show those in the future
  const multicall = new Multicall({ ethersProvider: provider, tryAggregate: true });
  const attributes = (await multicall.call(attributesCallContext)).results['attributes'].callsReturnContext;
  const borrowers = attributes.filter((v) => !v.success || !v.returnValues.at(1)).map((v) => v.returnValues[0]);

  return borrowers as Address[];
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
      contractAddress: ALOE_II_BORROWER_LENS_ADDRESS,
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
  const multicall = new Multicall({ ethersProvider: provider, tryAggregate: true });
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
      contractAddress: ALOE_II_ORACLE_ADDRESS,
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
