import { BigNumber, Contract, ContractReceipt, Signer } from 'ethers';
import { factoryAbi } from 'shared/lib/abis/Factory';
import { ALOE_II_FACTORY_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { generateBytes12Salt } from 'shared/lib/util/Salt';
import { Chain } from 'wagmi';

import { BLOCKS_TO_WAIT, GAS_ESTIMATION_SCALING } from '../data/constants/Values';

/**
 *
 * @param signer the signer to use for the transaction
 * @param poolAddress the pool address to be used for the Borrower
 * @param ownerAddress the address of the owner of the Borrower
 * @param commencementCallback a callback to be called when the transaction is sent
 * @param completionCallback a callback to be called when the transaction is completed
 */
export async function createBorrower(
  signer: Signer,
  poolAddress: string,
  ownerAddress: string,
  chain: Chain,
  commencementCallback: () => void,
  completionCallback: (receipt?: ContractReceipt) => void
): Promise<void> {
  const factory = new Contract(ALOE_II_FACTORY_ADDRESS[chain.id], factoryAbi, signer);
  const salt = generateBytes12Salt();

  let transactionOptions: any = {};

  try {
    const estimatedGas = (
      (await factory.estimateGas.createBorrower(poolAddress, ownerAddress, salt)) as BigNumber
    ).toNumber();

    transactionOptions['gasLimit'] = (estimatedGas * GAS_ESTIMATION_SCALING).toFixed(0);
  } catch (e) {
    console.error('Error while estimating gas');
    console.error(e);
  }

  try {
    const transactionResponse = await factory.createBorrower(poolAddress, ownerAddress, salt, transactionOptions);
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
