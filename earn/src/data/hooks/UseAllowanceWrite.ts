import { ethers } from 'ethers';
import { Chain, erc20ABI, useContractWrite, Address } from 'wagmi';

import { Token } from '../Token';

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
