import { CallReturnContext } from 'ethereum-multicall';
import { BigNumber } from 'ethers';

export function convertBigNumbers(callReturnContext: CallReturnContext[]): CallReturnContext[] {
  return callReturnContext.map((value) => {
    value.returnValues = value.returnValues.map((returnValue) => {
      if (returnValue?.type === 'BigNumber' && returnValue?.hex) {
        returnValue = BigNumber.from(returnValue.hex);
      }
      return returnValue as any[];
    });
    return value as CallReturnContext;
  });
}
