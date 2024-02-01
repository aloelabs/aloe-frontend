import { GN } from 'shared/lib/data/GoodNumber';
import { Address } from 'wagmi';

export type ModifyOperation = {
  owner: Address;
  indices: number[];
  managers: Address[];
  data: `0x${string}`[];
  antes: GN[];
};
