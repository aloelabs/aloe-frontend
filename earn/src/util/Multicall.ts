import { CallReturnContext } from 'ethereum-multicall';
import { BigNumber } from 'ethers';

export function convertBigNumbers(callReturnContext: CallReturnContext[]): CallReturnContext[] {
  return callReturnContext.map((value) => {
    value.returnValues = value.returnValues.map((returnValue) => {
      // If the return value is a BigNumber, convert it to an ethers BigNumber
      if (returnValue?.type === 'BigNumber' && returnValue?.hex) {
        returnValue = BigNumber.from(returnValue.hex);
      }
      return returnValue;
    });
    return value;
  });
}
