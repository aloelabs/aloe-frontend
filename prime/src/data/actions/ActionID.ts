import {
  ADD_LIQUIDITY,
  ADD_MARGIN,
  Action,
  BORROW,
  CLAIM_FEES,
  REMOVE_LIQUIDITY,
  REPAY,
  SWAP,
  WITHDRAW,
} from './Actions';

export enum ActionID {
  TRANSFER_IN,
  TRANSFER_OUT,
  BORROW,
  REPAY,
  ADD_LIQUIDITY,
  REMOVE_LIQUIDITY,
  CLAIM_FEES,
  SWAP,
}

export function getFrontendManagerCodeFor(id: ActionID) {
  switch (id) {
    case ActionID.TRANSFER_IN:
      return 0;
    case ActionID.TRANSFER_OUT:
      return 1;
    case ActionID.BORROW:
      return 2;
    case ActionID.REPAY:
      return 3;
    case ActionID.ADD_LIQUIDITY:
      return 4;
    // REMOVE_LIQUIDITY and CLAIM_FEES are the same thing under the hood
    case ActionID.REMOVE_LIQUIDITY:
      return 5;
    case ActionID.CLAIM_FEES:
      return 5;
    case ActionID.SWAP:
      return 6;
  }
}

export function getNameOfAction(id: ActionID): string {
  switch (id) {
    case ActionID.TRANSFER_IN:
      return 'Add Margin';
    case ActionID.TRANSFER_OUT:
      return 'Withdraw';
    case ActionID.BORROW:
      return 'Borrow';
    case ActionID.REPAY:
      return 'Repay';
    case ActionID.ADD_LIQUIDITY:
      return 'Add Liquidity';
    case ActionID.REMOVE_LIQUIDITY:
      return 'Remove Liquidity';
    case ActionID.CLAIM_FEES:
      return 'Claim Fees';
    case ActionID.SWAP:
      return 'Swap';
    default:
      return 'UNKNOWN';
  }
}

export function getAction(id: ActionID): Action {
  switch (id) {
    case ActionID.TRANSFER_IN:
      return ADD_MARGIN;
    case ActionID.TRANSFER_OUT:
      return WITHDRAW;
    case ActionID.BORROW:
      return BORROW;
    case ActionID.REPAY:
      return REPAY;
    case ActionID.ADD_LIQUIDITY:
      return ADD_LIQUIDITY;
    case ActionID.REMOVE_LIQUIDITY:
      return REMOVE_LIQUIDITY;
    case ActionID.CLAIM_FEES:
      return CLAIM_FEES;
    case ActionID.SWAP:
      return SWAP;
    default:
      return ADD_MARGIN;
  }
}
