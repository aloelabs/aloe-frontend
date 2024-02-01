import { GN } from 'shared/lib/data/GoodNumber';
import { Address } from 'wagmi';

import { MintOperation } from './MintOperation';
import { ModifyOperation } from './ModifyOperation';

type MulticallOperatorObserver = () => void;

export default class MulticallOperator {
  private owner: Address | undefined;
  private mintOperations: MintOperation[];
  private modifyOperations: ModifyOperation[];
  private observers: MulticallOperatorObserver[];

  constructor() {
    this.mintOperations = [];
    this.modifyOperations = [];
    this.observers = [];
  }

  subscribe(observer: MulticallOperatorObserver) {
    this.observers.push(observer);
  }

  unsubscribe(observer: MulticallOperatorObserver) {
    this.observers = this.observers.filter((o) => o !== observer);
  }

  notify() {
    this.observers.forEach((observer) => observer());
  }

  addMintOperation(mintOperation: MintOperation): MulticallOperator {
    this.mintOperations.push(mintOperation);
    this.notify();
    return this;
  }

  addModifyOperation(modifyOperation: ModifyOperation): MulticallOperator {
    if (this.owner === undefined) {
      this.owner = modifyOperation.owner;
    } else if (this.owner !== modifyOperation.owner) {
      throw new Error('Cannot add modify operation for a different owner');
    }
    this.modifyOperations.push(modifyOperation);
    this.notify();
    return this;
  }

  getMintOperations() {
    return this.mintOperations;
  }

  getModifyOperations() {
    return this.modifyOperations;
  }

  combineMintOperations(): MintOperation | undefined {
    if (this.mintOperations.length === 0) {
      return undefined;
    }
    let mintOperation: MintOperation = {
      to: this.mintOperations[0].to,
      pools: [],
      salts: [],
    };
    for (const op of this.mintOperations) {
      if (mintOperation.to !== op.to) {
        throw new Error('Cannot combine mint operations for different recipients');
      }
      mintOperation.pools.push(...op.pools);
      mintOperation.salts.push(...op.salts);
    }
    return mintOperation;
  }

  combineModifyOperations(): ModifyOperation {
    if (this.modifyOperations.length === 0 || this.owner === undefined) {
      throw new Error('Cannot combine modify operations');
    }
    let modifyOperation: ModifyOperation = {
      owner: this.owner,
      indices: [],
      managers: [],
      data: [],
      antes: [],
    };
    for (const op of this.modifyOperations) {
      modifyOperation.indices.push(...op.indices);
      modifyOperation.managers.push(...op.managers);
      modifyOperation.data.push(...op.data);
      modifyOperation.antes.push(...op.antes);
    }
    return modifyOperation;
  }

  getCombinedAnte(): GN {
    let ante = GN.zero(18);
    for (const modifyOperation of this.modifyOperations) {
      for (const a of modifyOperation.antes) {
        ante = ante.add(a);
      }
    }
    return ante;
  }
}
