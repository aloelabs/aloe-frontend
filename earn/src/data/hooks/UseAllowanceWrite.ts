import { ethers } from 'ethers';
import { Token } from 'shared/lib/data/Token';
import { Chain, erc20ABI, useContractWrite, Address } from 'wagmi';

export default function useAllowanceWrite(onChain: Chain, token: Token, spender: Address) {
  return useContractWrite({
    address: token.address,
    abi: erc20ABI,
    chainId: onChain.id,
    mode: 'recklesslyUnprepared',
    functionName: 'approve',
    args: [spender, ethers.constants.MaxUint256] as const,
  });
}
