import { Address } from 'wagmi';

export type MintOperation = {
  to: Address;
  pools: Address[];
  salts: `0x${string}`[];
};
