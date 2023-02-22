import { CallReturnContext, ContractCallReturnContext } from 'ethereum-multicall';
import { BigNumber } from 'ethers';

export type ContractCallReturnContextEntries = {
  [key: string]: ContractCallReturnContext;
};

export function convertBigNumbersForReturnContexts(callReturnContexts: CallReturnContext[]): CallReturnContext[] {
  return callReturnContexts.map((callReturnContext) => {
    callReturnContext.returnValues = callReturnContext.returnValues.map((returnValue) => {
      // If the return value is a BigNumber, convert it to an ethers BigNumber
      if (returnValue?.type === 'BigNumber' && returnValue?.hex) {
        returnValue = BigNumber.from(returnValue.hex);
      }
      return returnValue;
    });
    return callReturnContext;
  });
}
