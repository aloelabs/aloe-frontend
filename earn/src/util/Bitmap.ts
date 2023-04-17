import { BigNumber } from 'ethers';

function hexToBinary(hex: string) {
  if (hex.startsWith('0x')) hex = hex.slice(2);

  let result = '';

  for (let i = 0; i < hex.length; i += 1) {
    const bin = parseInt(hex[i], 16).toString(2).padStart(4, '0');
    result += bin;
  }

  return result;
}

export function firstZeroBitIn(bitmap: BigNumber) {
  const hex = bitmap.toHexString();
  const bin = hexToBinary(hex);
  return bin.indexOf('0');
}

export function randomHexValue(bits: number) {
  const alphabet = '0123456789abcdef';
  let hexString = '';
  for (let i = 0; i < Math.ceil(bits / 2); i += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    const randomChar = alphabet[randomIndex];
    hexString += randomChar;
  }
  return `0x${hexString}`;
}
