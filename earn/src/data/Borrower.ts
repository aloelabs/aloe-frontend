import { makeEtherscanRequest } from '../util/Etherscan';
import { ALOE_II_FACTORY_ADDRESS_GOERLI } from './constants/Addresses';

export async function getBorrowersForUser(userAddress: string): Promise<Array<string>> {
  const etherscanResult = await makeEtherscanRequest(
    8153850,
    ALOE_II_FACTORY_ADDRESS_GOERLI,
    ['0x1ff0a9a76572c6e0f2f781872c1e45b4bab3a0d90df274ebf884b4c11e3068f4'],
    true,
    'api-goerli'
  );
  if (!Array.isArray(etherscanResult.data.result)) return [];

  const addresses: string[] = etherscanResult.data.result
    .filter((item: any) => {
      return `0x${item.data.slice(26)}` !== userAddress;
    })
    .map((item: any) => {
      return item.topics[2].slice(26);
    });

  return addresses;
}
