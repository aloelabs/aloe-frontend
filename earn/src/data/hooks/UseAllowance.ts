import { BigNumber } from 'ethers';
import { Address, erc20ABI, useContractRead } from 'wagmi';
import { TokenData } from '../../data/TokenData';

export default function useAllowance(token: TokenData, owner: Address, spender: Address) {
  console.log('useAllowance', token, owner, spender);
  return useContractRead({
    address: token.address,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [owner, spender] as const,
    cacheOnBlock: true,
    watch: true,
  }) as { data: BigNumber | null };
}
