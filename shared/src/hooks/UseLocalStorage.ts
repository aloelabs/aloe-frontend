import { useState } from 'react';

export default function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error retrieving value from local storage:', error);
      return initialValue;
    }
  });
  const setValue = (valueOrOperator: T | ((x: T) => T)) => {
    try {
      const value = valueOrOperator instanceof Function ? valueOrOperator(storedValue) : valueOrOperator;
      setStoredValue(value);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error('Error setting value in local storage:', error);
    }
  };
  return [storedValue, setValue] as const;
}
