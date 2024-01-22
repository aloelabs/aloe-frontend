import { Address } from 'wagmi';

import { ModifyOperation } from './ModifyOperation';

type MulticallOperatorObserver = () => void;

export default class MulticallOperator {
  private owner: Address | undefined;
  private modifyOperations: ModifyOperation[];
  private observers: MulticallOperatorObserver[];

  constructor() {
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

  addModifyOperation(modifyOperation: ModifyOperation) {
    if (this.owner === undefined) {
      this.owner = modifyOperation.owner;
    } else if (this.owner !== modifyOperation.owner) {
      throw new Error('Cannot add modify operation for a different owner');
    }
    this.modifyOperations.push(modifyOperation);
    this.notify();
  }

  getModifyOperations() {
    return this.modifyOperations;
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
}
