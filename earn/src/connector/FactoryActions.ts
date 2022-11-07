import { BigNumber, Contract, ContractReceipt, Signer } from 'ethers';

import FactoryABI from '../assets/abis/Factory.json';
import { ALOE_II_FACTORY_ADDRESS_WITH_FAUCET_GOERLI } from '../data/constants/Addresses';
import { BLOCKS_TO_WAIT, GAS_ESTIMATION_SCALING } from '../data/constants/Values';

export async function createMarginAccount(
  signer: Signer,
  poolAddress: string,
  ownerAddress: string,
  completionCallback: (receipt?: ContractReceipt) => void
): Promise<void> {
  // TODO: Temporarily replacing actual factory with one that has a built-in faucet upon MarginAccount creation
  const factory = new Contract(ALOE_II_FACTORY_ADDRESS_WITH_FAUCET_GOERLI, FactoryABI, signer);

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
