import { BigNumber } from 'ethers';
import { Chain, erc20ABI, useContractWrite, Address } from 'wagmi';
import { UINT256_MAX } from '../../data/constants/Values';
import { TokenData } from '../../data/TokenData';

export default function useAllowanceWrite(onChain: Chain, token: TokenData, spender: Address) {
  return useContractWrite({
    address: token.address,
    abi: erc20ABI,
    chainId: onChain.id,
    mode: 'recklesslyUnprepared',
    functionName: 'approve',
    args: [spender, BigNumber.from(UINT256_MAX)] as const,
  });
}
