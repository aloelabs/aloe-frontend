import { useMemo, useState } from 'react';

export type SortConfig<T> = {
  primaryKey: keyof T;
  secondaryKey?: keyof T;
  direction: 'ascending' | 'descending';
};

export default function useSortableData<T>(
  rows: T[],
  config: SortConfig<T> | null = null
): {
  sortedRows: T[];
  requestSort: (primaryKey: keyof T, secondaryKey?: keyof T) => void;
  sortConfig: SortConfig<T> | null;
} {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(config);

  const sortedRows = useMemo(() => {
    let sortableRows = [...rows];
    if (sortConfig != null) {
      sortableRows.sort((a: T, b: T) => {
        if (a[sortConfig.primaryKey] < b[sortConfig.primaryKey]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.primaryKey] > b[sortConfig.primaryKey]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        if (sortConfig.secondaryKey) {
          if (a[sortConfig.secondaryKey] < b[sortConfig.secondaryKey]) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (a[sortConfig.secondaryKey] > b[sortConfig.secondaryKey]) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
        }
        return 0;
      });
    }
    return sortableRows;
  }, [rows, sortConfig]);

  const requestSort = (primaryKey: keyof T, secondaryKey?: keyof T) => {
    let direction: 'ascending' | 'descending' = 'descending';
    if (
      sortConfig?.primaryKey === primaryKey &&
      sortConfig?.secondaryKey === secondaryKey &&
      sortConfig?.direction === 'descending'
    ) {
      direction = 'ascending';
    }
    setSortConfig({ primaryKey, secondaryKey, direction });
  };

  return { sortedRows, requestSort, sortConfig };
}
