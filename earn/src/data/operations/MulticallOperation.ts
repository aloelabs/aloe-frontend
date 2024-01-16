import { Permit2Result } from 'shared/lib/data/hooks/UsePermit2';

export default class MulticallOperation {
  permit2Result: Permit2Result;
  generatedSalt: string;
  data: `0x${string}`[];

  constructor(permit2Result: Permit2Result, generatedSalt: string, data: `0x${string}`[]) {
    this.permit2Result = permit2Result;
    this.generatedSalt = generatedSalt;
    this.data = data;
  }
}
