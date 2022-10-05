import { erc20ABI, useContractRead } from 'wagmi';
import { TokenData } from '../../data/TokenData';

export default function useAllowance(token: TokenData, owner: string, spender: string) {
  return useContractRead({
    addressOrName: token.address,
    contractInterface: erc20ABI,
    functionName: 'allowance',
    args: [owner, spender],
    cacheOnBlock: true,
    watch: true,
  });
}
