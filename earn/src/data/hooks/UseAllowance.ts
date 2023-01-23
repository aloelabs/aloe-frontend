import { BigNumber } from 'ethers';
import { Address, Chain, erc20ABI, useContractRead } from 'wagmi';

import { Token } from '../Token';

export default function useAllowance(chain: Chain, token: Token, owner: Address, spender: Address) {
  return useContractRead({
    address: token.address,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [owner, spender] as const,
    cacheOnBlock: true,
    chainId: chain.id,
    // TODO: Add an alternative to watch that doesn't re-fetch each block (because of optimism)
    // watch: true,
  }) as { data: BigNumber | null };
}
