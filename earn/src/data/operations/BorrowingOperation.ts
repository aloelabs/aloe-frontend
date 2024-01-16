import { GN } from 'shared/lib/data/GoodNumber';
import { Permit2Result } from 'shared/lib/data/hooks/UsePermit2';

import { BorrowEntry, CollateralEntry } from '../../components/lend/BorrowingWidget';
import MulticallOperation from './MulticallOperation';

export default class BorrowingOperation extends MulticallOperation {
  amount: GN;
  ante: GN | undefined;
  selectedBorrow: BorrowEntry;
  selectedCollateral: CollateralEntry;

  constructor(
    amount: GN,
    ante: GN | undefined,
    selectedBorrow: BorrowEntry,
    selectedCollateral: CollateralEntry,
    permit2Result: Permit2Result,
    generatedSalt: string,
    data: `0x${string}`[]
  ) {
    super(permit2Result, generatedSalt, data);
    this.amount = amount;
    this.ante = ante;
    this.selectedBorrow = selectedBorrow;
    this.selectedCollateral = selectedCollateral;
  }
}
