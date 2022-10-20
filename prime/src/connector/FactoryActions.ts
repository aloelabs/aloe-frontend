import { BLOCKS_TO_WAIT, GAS_ESTIMATION_SCALING } from '../data/constants/Values';
import { BigNumber, Contract, ContractReceipt, Signer } from 'ethers';

import FactoryABI from '../assets/abis/Factory.json';
import { ALOE_II_FACTORY_ADDRESS_BUILT_IN_FAUCET_GOERLI } from '../data/constants/Addresses';

/**
 *
 * @param signer the signer to use for the transaction
 * @param poolAddress the pool address to be used for the margin account
 * @param ownerAddress the address of the owner of the margin account
 * @param commencementCallback a callback to be called when the transaction is sent
 * @param completionCallback a callback to be called when the transaction is completed
 */
export async function createMarginAccount(
  signer: Signer,
  poolAddress: string,
  ownerAddress: string,
  commencementCallback: () => void,
  completionCallback: (receipt?: ContractReceipt) => void
): Promise<void> {
  // TODO: Temporarily replacing actual factory with one that has a built-in faucet upon MarginAccount creation
  const factory = new Contract(ALOE_II_FACTORY_ADDRESS_BUILT_IN_FAUCET_GOERLI, FactoryABI, signer);

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
    // The txn was approved, now we wait
    commencementCallback();
    const receipt = await transactionResponse.wait(BLOCKS_TO_WAIT);
    // Tada! The txn is complete
    completionCallback(receipt);
  } catch (e) {
    // User probably rejected in MetaMask or wallet
    console.error(e);
    completionCallback();
  }
}
