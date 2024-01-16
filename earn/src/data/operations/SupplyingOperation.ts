import { GN } from 'shared/lib/data/GoodNumber';
import { Permit2Result } from 'shared/lib/data/hooks/UsePermit2';

import { SupplyTableRow } from '../../components/lend/SupplyTable';
import MulticallOperation from './MulticallOperation';

export default class SupplyingOperation extends MulticallOperation {
  amount: GN;
  selectedSupply: SupplyTableRow;

  constructor(
    amount: GN,
    selectedSupply: SupplyTableRow,
    permit2Result: Permit2Result,
    generatedSalt: string,
    data: `0x${string}`[]
  ) {
    super(permit2Result, generatedSalt, data);
    this.amount = amount;
    this.selectedSupply = selectedSupply;
  }
}
