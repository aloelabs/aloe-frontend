import { Chain, erc20ABI, useContractWrite } from 'wagmi';

import { UINT256_MAX } from '../../data/constants/Values';
import { TokenData } from '../../data/TokenData';

export default function useAllowanceWrite(onChain: Chain, token: TokenData, spender: string) {
  return useContractWrite({
    addressOrName: token.address,
    chainId: onChain.id,
    contractInterface: erc20ABI,
    mode: 'recklesslyUnprepared',
    functionName: 'approve',
    args: [spender, UINT256_MAX],
  });
}
