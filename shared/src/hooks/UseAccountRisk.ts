import { createContext, useContext } from 'react';
import { AccountRiskResult } from '../data/AccountRisk';

export const AccountRiskContext = createContext<AccountRiskResult | null>(null);

export function useAccountRisk(): AccountRiskResult {
  const ctxt = useContext(AccountRiskContext);
  return ctxt ?? { isBlocked: false, isLoading: true };
}
