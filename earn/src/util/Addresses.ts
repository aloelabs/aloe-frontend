import { Address } from 'wagmi';

export function truncateAddress(address: Address, totalLength = 10): string {
  const prefixLength = Math.floor(totalLength / 2);
  const suffixLength = totalLength - prefixLength;
  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}
