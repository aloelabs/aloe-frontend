import { BigNumber, Contract, ContractReceipt, Signer } from 'ethers';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { ALOE_II_FACTORY_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { Chain } from 'viem';

import { BLOCKS_TO_WAIT, GAS_ESTIMATION_SCALING } from '../data/constants/Values';

export async function createMarginAccount(
  signer: Signer,
  poolAddress: string,
  ownerAddress: string,
  completionCallback: (receipt?: ContractReceipt) => void,
  chain: Chain
): Promise<void> {
  const factory = new Contract(ALOE_II_FACTORY_ADDRESS[chain.id], factoryAbi, signer);

  let transactionOptions: any = {};

  try {
    const estimatedGas = (
      (await factory.estimateGas.createMarginAccount(poolAddress, ownerAddress)) as BigNumber
    ).toNumber();

    transactionOptions['gasLimit'] = (estimatedGas * GAS_ESTIMATION_SCALING).toFixed(0);
  } catch (e) {
    console.error('Error while estimating gas');
    console.error(e);
  }

  try {
    const transactionResponse = await factory.createMarginAccount(poolAddress, ownerAddress, transactionOptions);
    const receipt = await transactionResponse.wait(BLOCKS_TO_WAIT);
    completionCallback(receipt);
  } catch (e) {
    // User probably rejected in MetaMask or wallet
    console.error(e);
    completionCallback();
  }
}
