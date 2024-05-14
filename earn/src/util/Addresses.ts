import { Address } from 'viem';

export function truncateAddress(address: Address, totalLength = 10): string {
  const prefixLength = Math.floor(totalLength / 2);
  const suffixLength = totalLength - prefixLength;
  return `${address.slice(0, 2 + prefixLength)}...${address.slice(-suffixLength)}`;
}
