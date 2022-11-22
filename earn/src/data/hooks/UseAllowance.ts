import { BigNumber } from 'ethers';
import { Address, erc20ABI, useContractRead } from 'wagmi';

import { Token } from '../Token';

export default function useAllowance(token: Token, owner: Address, spender: Address) {
  return useContractRead({
    address: token.address,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [owner, spender] as const,
    cacheOnBlock: true,
    watch: true,
  }) as { data: BigNumber | null };
}
