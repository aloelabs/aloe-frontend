import { Address } from 'wagmi';

export type ModifyOperation = {
  owner: Address;
  indices: number[];
  managers: Address[];
  data: `0x${string}`[];
  antes: number[];
};
