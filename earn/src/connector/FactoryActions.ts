import { Contract, ContractReceipt } from 'ethers';

import { BLOCKS_TO_WAIT } from '../data/constants/Values';

export async function createMarginAccount(
  factory: Contract,
  poolAddress: string,
  ownerAddress: string,
  completionCallback: (receipt?: ContractReceipt) => void
): Promise<void> {
  let transactionOptions: any = {};
  transactionOptions['gasLimit'] = 100000000;

  try {
    const transactionResponse = await factory.createBorrower(poolAddress, ownerAddress, transactionOptions);
    const receipt = await transactionResponse.wait(BLOCKS_TO_WAIT);
    completionCallback(receipt);
  } catch (e) {
    // User probably rejected in MetaMask or wallet
    console.error(e);
    completionCallback();
  }
}
