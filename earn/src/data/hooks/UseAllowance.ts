import { BigNumber } from 'ethers';
import { Token } from 'shared/lib/data/Token';
import { Address, Chain, erc20ABI, useContractRead } from 'wagmi';

export default function useAllowance(chain: Chain, token: Token, owner: Address, spender: Address) {
  return useContractRead({
    address: token.address,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [owner, spender] as const,
    cacheOnBlock: true,
    chainId: chain.id,
  }) as { refetch: () => void; data: BigNumber | null };
}
