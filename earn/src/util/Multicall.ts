import { CallReturnContext } from 'ethereum-multicall';
import { BigNumber } from 'ethers';

export function convertBigNumbersForReturnContexts(callReturnContext: CallReturnContext[]): CallReturnContext[] {
  return Object.values(callReturnContext).map((value) => {
    value.returnValues = Object.values(value.returnValues).map((returnValue) => {
      if (returnValue?.type === 'BigNumber') {
        returnValue = BigNumber.from(returnValue.hex);
      }
      return returnValue as any[];
    });
    return value as CallReturnContext;
  });
}
