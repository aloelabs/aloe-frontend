import { useQuery } from '@tanstack/react-query';
import type { Abi, BlockNumber, BlockTag, ContractEventName, GetContractEventsParameters } from 'viem';
import { usePublicClient } from 'wagmi';

export default function useContractEvents<
  const abi extends Abi | readonly unknown[],
  eventName extends ContractEventName<abi> | undefined = undefined,
  strict extends boolean | undefined = undefined,
  fromBlock extends BlockNumber | BlockTag = 'earliest',
  toBlock extends BlockNumber | BlockTag = 'latest'
>(args: GetContractEventsParameters<abi, eventName, strict, fromBlock, toBlock> & { query?: { enabled?: boolean } }) {
  const publicClient = usePublicClient();

  if (args.blockHash === undefined) {
    if (args.fromBlock === undefined) args.fromBlock = 'earliest';
    if (args.toBlock === undefined) args.toBlock = 'latest';
  }

  const queryFn = async () => {
    if (publicClient === undefined) {
      throw new Error(`Tried to query contract events when publicClient was undefined.`);
    }
    return publicClient.getContractEvents(args);
  };

  const queryKey = ['useContractEvents', publicClient?.chain.id, args];

  return useQuery({
    queryKey,
    queryFn,
    staleTime: Infinity,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: [],
    enabled: args.query?.enabled,
  });
}
